#!/usr/bin/env node
/**
 * Builds supabase/migrations/<timestamp>_seed_regulatory_library.sql from the
 * JSON sources in supabase/seed/regulatory-library/.
 *
 *   node scripts/build-regulatory-seed.mjs            # rebuild the seed migration
 *   node scripts/build-regulatory-seed.mjs --check    # validate JSON only
 *
 * The generated SQL is idempotent: frameworks upsert on `code`, controls upsert
 * on (framework_id, control_ref). Re-running the migration after editing JSON
 * updates text in place without duplicating rows.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SEED_DIR = join(ROOT, 'supabase', 'seed', 'regulatory-library')
const OUT_FILE = join(
  ROOT,
  'supabase',
  'migrations',
  '20260903120100_seed_regulatory_library.sql'
)

const checkOnly = process.argv.includes('--check')
// A database that already applied the canonical seed will not re-run it. When the
// JSON changes (e.g. after an Arabic review), emit a new timestamped migration so
// `supabase db push` carries the update to an existing database.
const asNewMigration = process.argv.includes('--as-new-migration')

const FIDELITY = new Set(['structural', 'paraphrased', 'summarized'])
const CONTROL_TYPE = new Set(['governance', 'preventive', 'detective', 'corrective'])
const CRITICALITY = new Set(['high', 'medium', 'low'])
const CATEGORY = new Set([
  'cybersecurity',
  'data-protection',
  'ai-governance',
  'technology-risk',
  'information-security',
])

function q(value) {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  return `'${String(value).replace(/'/g, "''")}'`
}

function fail(file, msg) {
  console.error(`✗ ${file}: ${msg}`)
  process.exitCode = 1
}

function flatten(doc, file) {
  const defaults = doc.defaults ?? {}
  const rows = []
  let sort = 0
  const seen = new Set()

  for (const domain of doc.domains ?? []) {
    for (const sub of domain.subdomains ?? [{ en: null, ar: null, controls: domain.controls ?? [] }]) {
      for (const c of sub.controls ?? []) {
        sort += 10
        if (!c.ref) fail(file, `control without ref in domain "${domain.en}"`)
        if (seen.has(c.ref)) fail(file, `duplicate control ref ${c.ref}`)
        seen.add(c.ref)
        if (!c.title_en) fail(file, `${c.ref}: missing title_en`)
        if (!c.requirement_en) fail(file, `${c.ref}: missing requirement_en`)
        const fidelity = c.fidelity ?? defaults.fidelity ?? 'paraphrased'
        if (!FIDELITY.has(fidelity)) fail(file, `${c.ref}: bad fidelity ${fidelity}`)
        if ((c.verified ?? defaults.verified) && !c.verified_by) {
          fail(file, `${c.ref}: verified is true but verified_by is missing — a verification needs a named reviewer`)
        }
        if (c.control_type && !CONTROL_TYPE.has(c.control_type)) fail(file, `${c.ref}: bad control_type ${c.control_type}`)
        if (c.criticality && !CRITICALITY.has(c.criticality)) fail(file, `${c.ref}: bad criticality ${c.criticality}`)

        rows.push({
          control_ref: c.ref,
          domain_en: domain.en ?? null,
          domain_ar: domain.ar ?? null,
          subdomain_en: sub.en ?? null,
          subdomain_ar: sub.ar ?? null,
          title_en: c.title_en,
          title_ar: c.title_ar ?? null,
          requirement_en: c.requirement_en,
          requirement_ar: c.requirement_ar ?? null,
          evidence_en: c.evidence_en ?? null,
          control_type: c.control_type ?? null,
          criticality: c.criticality ?? null,
          fidelity,
          verified: Boolean(c.verified ?? defaults.verified ?? false),
          verified_by: c.verified_by ?? null,
          verified_at: c.verified_at ?? null,
          sort_order: sort,
        })
      }
    }
  }
  return rows
}

const files = readdirSync(SEED_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()

const docs = []
for (const file of files) {
  let doc
  try {
    doc = JSON.parse(readFileSync(join(SEED_DIR, file), 'utf8'))
  } catch (e) {
    fail(file, `invalid JSON: ${e.message}`)
    continue
  }
  const f = doc.framework ?? {}
  for (const key of ['code', 'short_name', 'name_en', 'regulator_en', 'jurisdiction', 'category']) {
    if (!f[key]) fail(file, `framework.${key} is required`)
  }
  if (f.category && !CATEGORY.has(f.category)) fail(file, `bad category ${f.category}`)
  const controls = flatten(doc, file)
  docs.push({ file, framework: f, controls })
}

if (process.exitCode) {
  console.error('Seed validation failed.')
  process.exit(1)
}

const totals = docs.map((d) => `${d.framework.code.padEnd(12)} ${String(d.controls.length).padStart(4)} controls`)
console.log(totals.join('\n'))
console.log(`${'TOTAL'.padEnd(12)} ${String(docs.reduce((n, d) => n + d.controls.length, 0)).padStart(4)} controls across ${docs.length} frameworks`)

if (checkOnly) process.exit(0)

const lines = []
lines.push('-- =============================================================================')
lines.push('-- AETHER Regulatory Library — seed data')
lines.push('-- GENERATED FILE. Do not edit by hand.')
lines.push('-- Source: supabase/seed/regulatory-library/*.json')
lines.push('-- Rebuild: node scripts/build-regulatory-seed.mjs')
lines.push(`-- Generated: ${new Date().toISOString()}`)
lines.push('-- =============================================================================')
lines.push('')
lines.push('begin;')
lines.push('')

for (const { framework: f, controls } of docs) {
  lines.push(`-- ---------------------------------------------------------------------------`)
  lines.push(`-- ${f.code}: ${f.name_en} (${controls.length} controls)`)
  lines.push(`-- ---------------------------------------------------------------------------`)
  lines.push(`insert into public.frameworks (code, short_name, name_en, name_ar, regulator_en, regulator_ar, jurisdiction, category, version, effective_date, source_url, description_en, description_ar, mandatory, sort_order)`)
  lines.push(`values (${[
    q(f.code), q(f.short_name), q(f.name_en), q(f.name_ar ?? null), q(f.regulator_en), q(f.regulator_ar ?? null),
    q(f.jurisdiction), q(f.category), q(f.version ?? null), q(f.effective_date ?? null), q(f.source_url ?? null),
    q(f.description_en ?? null), q(f.description_ar ?? null), q(Boolean(f.mandatory)), q(f.sort_order ?? 0),
  ].join(', ')})`)
  lines.push(`on conflict (code) do update set`)
  lines.push(`  short_name = excluded.short_name, name_en = excluded.name_en, name_ar = excluded.name_ar,`)
  lines.push(`  regulator_en = excluded.regulator_en, regulator_ar = excluded.regulator_ar, jurisdiction = excluded.jurisdiction,`)
  lines.push(`  category = excluded.category, version = excluded.version, effective_date = excluded.effective_date,`)
  lines.push(`  source_url = excluded.source_url, description_en = excluded.description_en, description_ar = excluded.description_ar,`)
  lines.push(`  mandatory = excluded.mandatory, sort_order = excluded.sort_order;`)
  lines.push('')

  if (controls.length > 0) {
    lines.push(`insert into public.controls (framework_id, control_ref, domain_en, domain_ar, subdomain_en, subdomain_ar, title_en, title_ar, requirement_en, requirement_ar, evidence_en, control_type, criticality, fidelity, verified, verified_by, verified_at, sort_order)`)
    lines.push(`select f.id, c.control_ref, c.domain_en, c.domain_ar, c.subdomain_en, c.subdomain_ar,`)
    lines.push(`       c.title_en, c.title_ar, c.requirement_en, c.requirement_ar, c.evidence_en,`)
    lines.push(`       c.control_type, c.criticality, c.fidelity, c.verified, c.verified_by,`)
    lines.push(`       c.verified_at::date, c.sort_order`)
    lines.push(`from public.frameworks f`)
    lines.push(`cross join (values`)
    const valueRows = controls.map((c) => `  (${[
      q(c.control_ref), q(c.domain_en), q(c.domain_ar), q(c.subdomain_en), q(c.subdomain_ar),
      q(c.title_en), q(c.title_ar), q(c.requirement_en), q(c.requirement_ar), q(c.evidence_en),
      q(c.control_type), q(c.criticality), q(c.fidelity), q(c.verified), q(c.verified_by), q(c.verified_at), q(c.sort_order),
    ].join(', ')})`)
    lines.push(valueRows.join(',\n'))
    lines.push(`) as c(control_ref, domain_en, domain_ar, subdomain_en, subdomain_ar, title_en, title_ar, requirement_en, requirement_ar, evidence_en, control_type, criticality, fidelity, verified, verified_by, verified_at, sort_order)`)
    lines.push(`where f.code = ${q(f.code)}`)
    lines.push(`on conflict (framework_id, control_ref) do update set`)
    lines.push(`  domain_en = excluded.domain_en, domain_ar = excluded.domain_ar,`)
    lines.push(`  subdomain_en = excluded.subdomain_en, subdomain_ar = excluded.subdomain_ar,`)
    lines.push(`  title_en = excluded.title_en, title_ar = excluded.title_ar,`)
    lines.push(`  requirement_en = excluded.requirement_en, requirement_ar = excluded.requirement_ar,`)
    lines.push(`  evidence_en = excluded.evidence_en, control_type = excluded.control_type,`)
    lines.push(`  criticality = excluded.criticality, fidelity = excluded.fidelity,`)
    lines.push(`  verified = excluded.verified, verified_by = excluded.verified_by,
  verified_at = excluded.verified_at, sort_order = excluded.sort_order;`)
    lines.push('')
  }
}

lines.push('commit;')
lines.push('')

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
const target = asNewMigration
  ? join(ROOT, 'supabase', 'migrations', `${stamp}_refresh_regulatory_library.sql`)
  : OUT_FILE
writeFileSync(target, lines.join('\n'))
console.log(`\n→ wrote ${target}`)
if (!asNewMigration) {
  console.log(
    'Note: this overwrites the canonical seed. A database that already applied it will\n' +
    '      NOT pick up the change — use --as-new-migration to emit an update migration.'
  )
}
