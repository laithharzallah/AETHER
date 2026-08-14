#!/usr/bin/env node
// =============================================================================
// Generates lib/database.types.ts by introspecting a Postgres database.
//
// `supabase gen types` requires Docker even when handed a --db-url, which makes
// it unusable in CI and in any container without a Docker socket. This produces
// the same shape by reading the catalog through psql.
//
// Usage:
//   node scripts/gen-types.mjs --db-url postgresql://user:pass@host:port/db
//   node scripts/gen-types.mjs                # uses AETHER_TYPES_DB_URL
//
// Writes to stdout; redirect it yourself, or pass --out <path>.
// =============================================================================

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
function arg(name, fallback = undefined) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const dbUrl = arg('db-url', process.env.AETHER_TYPES_DB_URL)
const outPath = arg('out')

if (!dbUrl) {
  console.error('error: pass --db-url or set AETHER_TYPES_DB_URL')
  process.exit(2)
}

function query(sql) {
  const out = execFileSync(
    'psql',
    [dbUrl, '-X', '-A', '-t', '-q', '--no-psqlrc', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  )
  const trimmed = out.trim()
  return trimmed ? JSON.parse(trimmed) : []
}

// -----------------------------------------------------------------------------
// Postgres type -> TypeScript type
// -----------------------------------------------------------------------------

const SCALARS = {
  bool: 'boolean',
  int2: 'number',
  int4: 'number',
  int8: 'number',
  float4: 'number',
  float8: 'number',
  numeric: 'number',
  money: 'number',
  json: 'Json',
  jsonb: 'Json',
  text: 'string',
  varchar: 'string',
  bpchar: 'string',
  char: 'string',
  name: 'string',
  citext: 'string',
  uuid: 'string',
  date: 'string',
  time: 'string',
  timetz: 'string',
  timestamp: 'string',
  timestamptz: 'string',
  interval: 'string',
  inet: 'string',
  cidr: 'string',
  macaddr: 'string',
  bytea: 'string',
  tsvector: 'string',
  xml: 'string',
}

function tsType(udtName, enums) {
  if (udtName.startsWith('_')) {
    const inner = tsType(udtName.slice(1), enums)
    return `${inner}[]`
  }
  if (enums[udtName]) {
    return `Database["public"]["Enums"]["${udtName}"]`
  }
  return SCALARS[udtName] ?? 'unknown'
}

// -----------------------------------------------------------------------------
// Introspection
// -----------------------------------------------------------------------------

const enumRows = query(`
  select coalesce(json_agg(row_to_json(e) order by e.enum_name), '[]'::json)
  from (
    select t.typname as enum_name,
           array_agg(v.enumlabel order by v.enumsortorder) as labels
    from pg_type t
    join pg_enum v on v.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    group by t.typname
  ) e
`)

const enums = {}
for (const row of enumRows) enums[row.enum_name] = row.labels

const columnRows = query(`
  select coalesce(json_agg(row_to_json(c) order by c.table_name, c.ordinal_position), '[]'::json)
  from (
    select
      cls.relname                                as table_name,
      cls.relkind                                as rel_kind,
      att.attname                                as column_name,
      att.attnum                                 as ordinal_position,
      not att.attnotnull                         as is_nullable,
      typ.typname                                as udt_name,
      pg_get_expr(def.adbin, def.adrelid) is not null as has_default,
      att.attidentity <> ''                      as is_identity,
      att.attgenerated <> ''                     as is_generated
    from pg_attribute att
    join pg_class cls on cls.oid = att.attrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    join pg_type typ on typ.oid = att.atttypid
    left join pg_attrdef def on def.adrelid = cls.oid and def.adnum = att.attnum
    where nsp.nspname = 'public'
      and cls.relkind in ('r', 'v', 'm')
      and att.attnum > 0
      and not att.attisdropped
  ) c
`)

const fkRows = query(`
  select coalesce(json_agg(row_to_json(f) order by f.table_name, f.constraint_name), '[]'::json)
  from (
    select
      con.conname                     as constraint_name,
      child.relname                   as table_name,
      parent.relname                  as referenced_table,
      (
        select array_agg(a.attname order by u.ord)
        from unnest(con.conkey) with ordinality as u(attnum, ord)
        join pg_attribute a on a.attrelid = con.conrelid and a.attnum = u.attnum
      )                               as columns,
      (
        select array_agg(a.attname order by u.ord)
        from unnest(con.confkey) with ordinality as u(attnum, ord)
        join pg_attribute a on a.attrelid = con.confrelid and a.attnum = u.attnum
      )                               as referenced_columns,
      exists (
        select 1 from pg_index i
        where i.indrelid = con.conrelid
          and i.indisunique
          and i.indnatts = cardinality(con.conkey)
          and (
            select array_agg(k order by k) from unnest(i.indkey::int[]) as k
          ) = (
            select array_agg(k order by k) from unnest(con.conkey::int[]) as k
          )
      )                               as is_one_to_one
    from pg_constraint con
    join pg_class child on child.oid = con.conrelid
    join pg_class parent on parent.oid = con.confrelid
    join pg_namespace nsp on nsp.oid = child.relnamespace
    where con.contype = 'f' and nsp.nspname = 'public'
  ) f
`)

const functionRows = query(`
  select coalesce(json_agg(row_to_json(fn) order by fn.function_name), '[]'::json)
  from (
    select distinct on (p.proname)
      p.proname                                       as function_name,
      pg_get_function_arguments(p.oid)                as args,
      pg_get_function_result(p.oid)                   as result,
      p.proretset                                     as returns_set
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      -- Trigger functions are not callable over the API surface.
      and pg_get_function_result(p.oid) <> 'trigger'
      -- Internal seed and DDL helpers.
      and p.proname not like 'upsert_%'
      and p.proname not like 'ensure_%'
      and p.proname not like 'apply_%'
      -- Functions installed by an extension. pgcrypto lands in \`extensions\` on
      -- Supabase but in \`public\` on a stock install, where it would otherwise
      -- contribute a few hundred irrelevant (and overloaded) entries.
      and not exists (
        select 1 from pg_depend d
        where d.objid = p.oid
          and d.classid = 'pg_proc'::regclass
          and d.deptype = 'e'
      )
    order by p.proname, p.pronargs
  ) fn
`)

// -----------------------------------------------------------------------------
// Assemble
// -----------------------------------------------------------------------------

const tables = new Map()
for (const col of columnRows) {
  if (!tables.has(col.table_name)) {
    tables.set(col.table_name, { kind: col.rel_kind, columns: [] })
  }
  tables.get(col.table_name).columns.push(col)
}

const fkByTable = new Map()
for (const fk of fkRows) {
  if (!fkByTable.has(fk.table_name)) fkByTable.set(fk.table_name, [])
  fkByTable.get(fk.table_name).push(fk)
}

function indent(level) {
  return '  '.repeat(level)
}

function renderRelationships(tableName, level) {
  const fks = fkByTable.get(tableName) ?? []
  if (fks.length === 0) return `${indent(level)}Relationships: []`

  const lines = [`${indent(level)}Relationships: [`]
  for (const fk of fks) {
    lines.push(`${indent(level + 1)}{`)
    lines.push(`${indent(level + 2)}foreignKeyName: "${fk.constraint_name}"`)
    lines.push(
      `${indent(level + 2)}columns: [${fk.columns.map((c) => `"${c}"`).join(', ')}]`
    )
    lines.push(`${indent(level + 2)}isOneToOne: ${fk.is_one_to_one ? 'true' : 'false'}`)
    lines.push(`${indent(level + 2)}referencedRelation: "${fk.referenced_table}"`)
    lines.push(
      `${indent(level + 2)}referencedColumns: [${fk.referenced_columns
        .map((c) => `"${c}"`)
        .join(', ')}]`
    )
    lines.push(`${indent(level + 1)}},`)
  }
  lines.push(`${indent(level)}]`)
  return lines.join('\n')
}

function renderRelation(name, meta, level) {
  const isView = meta.kind !== 'r'
  const lines = [`${indent(level)}${name}: {`]

  // Row
  lines.push(`${indent(level + 1)}Row: {`)
  for (const col of meta.columns) {
    const t = tsType(col.udt_name, enums)
    lines.push(
      `${indent(level + 2)}${col.column_name}: ${t}${col.is_nullable ? ' | null' : ''}`
    )
  }
  lines.push(`${indent(level + 1)}}`)

  if (!isView) {
    // Insert: optional when the database can supply the value itself.
    lines.push(`${indent(level + 1)}Insert: {`)
    for (const col of meta.columns) {
      const t = tsType(col.udt_name, enums)
      const optional =
        col.is_nullable || col.has_default || col.is_identity || col.is_generated
      lines.push(
        `${indent(level + 2)}${col.column_name}${optional ? '?' : ''}: ${t}${
          col.is_nullable ? ' | null' : ''
        }`
      )
    }
    lines.push(`${indent(level + 1)}}`)

    // Update: everything optional.
    lines.push(`${indent(level + 1)}Update: {`)
    for (const col of meta.columns) {
      const t = tsType(col.udt_name, enums)
      lines.push(
        `${indent(level + 2)}${col.column_name}?: ${t}${col.is_nullable ? ' | null' : ''}`
      )
    }
    lines.push(`${indent(level + 1)}}`)
  }

  lines.push(renderRelationships(name, level + 1))
  lines.push(`${indent(level)}}`)
  return lines.join('\n')
}

const tableNames = [...tables.entries()]
  .filter(([, m]) => m.kind === 'r')
  .map(([n]) => n)
  .sort()
const viewNames = [...tables.entries()]
  .filter(([, m]) => m.kind !== 'r')
  .map(([n]) => n)
  .sort()

const out = []
out.push('// Generated by scripts/gen-types.mjs — do not edit by hand.')
out.push('//')
out.push('// Regenerate with:')
out.push('//   npm run db:types            (requires Docker + Supabase CLI)')
out.push('//   npm run db:types:local      (psql only, against a verified local schema)')
out.push('')
out.push('export type Json =')
out.push('  | string')
out.push('  | number')
out.push('  | boolean')
out.push('  | null')
out.push('  | { [key: string]: Json | undefined }')
out.push('  | Json[]')
out.push('')
out.push('export type Database = {')
out.push('  __InternalSupabase: {')
out.push('    PostgrestVersion: "14.5"')
out.push('  }')
out.push('  public: {')
out.push('    Tables: {')
for (const name of tableNames) {
  out.push(renderRelation(name, tables.get(name), 3))
}
out.push('    }')

out.push('    Views: {')
if (viewNames.length === 0) {
  out.push('      [_ in never]: never')
} else {
  for (const name of viewNames) {
    out.push(renderRelation(name, tables.get(name), 3))
  }
}
out.push('    }')

// Functions are emitted as a name-keyed record. Supabase's own generator types
// Args and Returns precisely; reproducing that faithfully needs more catalog
// work than it is worth, so the signature is recorded as a doc comment and the
// callable surface is typed loosely rather than wrongly.
out.push('    Functions: {')
if (functionRows.length === 0) {
  out.push('      [_ in never]: never')
} else {
  for (const fn of functionRows) {
    out.push(`      /** ${fn.function_name}(${fn.args}) -> ${fn.result} */`)
    out.push(`      ${fn.function_name}: {`)
    out.push('        Args: Record<string, unknown>')
    out.push(`        Returns: ${fn.returns_set ? 'Json[]' : 'Json'}`)
    out.push('      }')
  }
}
out.push('    }')

out.push('    Enums: {')
const enumNames = Object.keys(enums).sort()
if (enumNames.length === 0) {
  out.push('      [_ in never]: never')
} else {
  for (const name of enumNames) {
    out.push(`      ${name}: ${enums[name].map((l) => `"${l}"`).join(' | ')}`)
  }
}
out.push('    }')

out.push('    CompositeTypes: {')
out.push('      [_ in never]: never')
out.push('    }')
out.push('  }')
out.push('}')
out.push('')

// -----------------------------------------------------------------------------
// The helper types Supabase ships alongside the schema, kept verbatim so
// existing imports keep working.
// -----------------------------------------------------------------------------

out.push(`type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {${enumNames.length ? '\n' + enumNames.map((n) => `      ${n}: [${enums[n].map((l) => `"${l}"`).join(', ')}],`).join('\n') + '\n    ' : ''}},
  },
} as const`)

const rendered = out.join('\n') + '\n'

if (outPath) {
  writeFileSync(outPath, rendered)
  console.error(
    `wrote ${outPath}: ${tableNames.length} tables, ${viewNames.length} views, ${functionRows.length} functions`
  )
} else {
  process.stdout.write(rendered)
}
