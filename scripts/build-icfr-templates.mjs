#!/usr/bin/env node
/**
 * Builds supabase/migrations/20260903150100_icfr_templates.sql from the JSON
 * sources in supabase/seed/icfr-templates/.
 *
 *   node scripts/build-icfr-templates.mjs            # rebuild the seed migration
 *   node scripts/build-icfr-templates.mjs --check    # validate JSON only
 *
 * The generated SQL is idempotent: templates upsert on `code`, items upsert on
 * (template_id, ref). Items removed from JSON are deleted from the database so
 * the template always mirrors the source.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SEED_DIR = join(ROOT, 'supabase', 'seed', 'icfr-templates')
const OUT_FILE = join(
  ROOT,
  'supabase',
  'migrations',
  '20260903150100_icfr_templates.sql'
)

const checkOnly = process.argv.includes('--check')

const ASSERTIONS = new Set([
  'existence_occurrence',
  'completeness',
  'accuracy',
  'valuation_allocation',
  'cutoff',
  'rights_obligations',
  'presentation_disclosure',
])
const CONTROL_TYPE = new Set(['preventive', 'detective'])
const NATURE = new Set(['manual', 'automated', 'it_dependent'])
const FREQUENCY = new Set([
  'multiple_daily',
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'annually',
  'event_driven',
])
const LEVEL = new Set(['entity', 'process', 'itgc'])
const COSO = new Set([
  'control_environment',
  'risk_assessment',
  'control_activities',
  'information_communication',
  'monitoring',
])

function q(value) {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  return `'${String(value).replace(/'/g, "''")}'`
}

function qArray(values) {
  if (!values) return 'null'
  if (values.length === 0) return `'{}'::text[]`
  return `array[${values.map(q).join(', ')}]::text[]`
}

function fail(file, msg) {
  console.error(`✗ ${file}: ${msg}`)
  process.exitCode = 1
}

function validate(doc, file) {
  const t = doc.template ?? {}
  for (const key of ['code', 'name', 'cycle']) {
    if (!t[key]) fail(file, `template.${key} is required`)
  }

  const riskRefs = new Set()
  const risks = doc.risks ?? []
  const controls = doc.controls ?? []

  if (risks.length < 5 || risks.length > 8) {
    fail(file, `expected 5–8 risks, found ${risks.length}`)
  }
  if (controls.length < 8 || controls.length > 14) {
    fail(file, `expected 8–14 controls, found ${controls.length}`)
  }

  for (const r of risks) {
    if (!r.ref) fail(file, 'risk without ref')
    if (riskRefs.has(r.ref)) fail(file, `duplicate risk ref ${r.ref}`)
    riskRefs.add(r.ref)
    if (!r.title) fail(file, `${r.ref}: missing title`)
    if (!Array.isArray(r.assertions) || r.assertions.length === 0) {
      fail(file, `${r.ref}: assertions must be a non-empty array`)
    } else {
      for (const a of r.assertions) {
        if (!ASSERTIONS.has(a)) fail(file, `${r.ref}: bad assertion ${a}`)
      }
    }
  }

  const controlRefs = new Set()
  const coveredRisks = new Set()
  for (const c of controls) {
    if (!c.ref) fail(file, 'control without ref')
    if (controlRefs.has(c.ref) || riskRefs.has(c.ref)) fail(file, `duplicate ref ${c.ref}`)
    controlRefs.add(c.ref)
    if (!c.title) fail(file, `${c.ref}: missing title`)
    if (!c.description) fail(file, `${c.ref}: missing description`)
    if (!CONTROL_TYPE.has(c.control_type)) fail(file, `${c.ref}: bad control_type ${c.control_type}`)
    if (!NATURE.has(c.nature)) fail(file, `${c.ref}: bad nature ${c.nature}`)
    if (!FREQUENCY.has(c.frequency)) fail(file, `${c.ref}: bad frequency ${c.frequency}`)
    if (typeof c.is_key !== 'boolean') fail(file, `${c.ref}: is_key must be boolean`)
    if (!LEVEL.has(c.level)) fail(file, `${c.ref}: bad level ${c.level}`)
    if (!COSO.has(c.coso_component)) fail(file, `${c.ref}: bad coso_component ${c.coso_component}`)
    if (!Array.isArray(c.linked_risk_refs) || c.linked_risk_refs.length === 0) {
      fail(file, `${c.ref}: linked_risk_refs must be a non-empty array`)
    } else {
      for (const ref of c.linked_risk_refs) {
        if (!riskRefs.has(ref)) fail(file, `${c.ref}: links to unknown risk ${ref}`)
        coveredRisks.add(ref)
      }
    }
  }
  for (const ref of riskRefs) {
    if (!coveredRisks.has(ref)) fail(file, `risk ${ref} has no linked control`)
  }
}

function toItems(doc) {
  const items = []
  let sort = 0
  for (const r of doc.risks ?? []) {
    sort += 10
    items.push({
      kind: 'risk',
      ref: r.ref,
      title: r.title,
      description: r.description ?? null,
      assertions: r.assertions,
      control_type: null,
      nature: null,
      frequency: null,
      is_key: null,
      level: null,
      coso_component: null,
      linked_risk_refs: null,
      sort_order: sort,
    })
  }
  for (const c of doc.controls ?? []) {
    sort += 10
    items.push({
      kind: 'control',
      ref: c.ref,
      title: c.title,
      description: c.description,
      assertions: null,
      control_type: c.control_type,
      nature: c.nature,
      frequency: c.frequency,
      is_key: c.is_key,
      level: c.level,
      coso_component: c.coso_component,
      linked_risk_refs: c.linked_risk_refs,
      sort_order: sort,
    })
  }
  return items
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
  validate(doc, file)
  docs.push({ file, template: doc.template, items: toItems(doc), riskCount: (doc.risks ?? []).length, controlCount: (doc.controls ?? []).length })
}

const codes = new Set()
for (const d of docs) {
  if (codes.has(d.template.code)) fail(d.file, `duplicate template code ${d.template.code}`)
  codes.add(d.template.code)
}

if (process.exitCode) {
  console.error('Template validation failed.')
  process.exit(1)
}

docs.sort((a, b) => (a.template.sort_order ?? 0) - (b.template.sort_order ?? 0))

for (const d of docs) {
  console.log(`${d.template.code.padEnd(6)} ${String(d.riskCount).padStart(3)} risks ${String(d.controlCount).padStart(3)} controls`)
}
console.log(
  `${'TOTAL'.padEnd(6)} ${String(docs.reduce((n, d) => n + d.riskCount, 0)).padStart(3)} risks ${String(docs.reduce((n, d) => n + d.controlCount, 0)).padStart(3)} controls across ${docs.length} templates`
)

if (checkOnly) process.exit(0)

const lines = []
lines.push('-- =============================================================================')
lines.push('-- AETHER ICFR — RCM template seed data')
lines.push('-- GENERATED FILE. Do not edit by hand.')
lines.push('-- Source: supabase/seed/icfr-templates/*.json')
lines.push('-- Rebuild: node scripts/build-icfr-templates.mjs')
lines.push(`-- Generated: ${new Date().toISOString()}`)
lines.push('-- =============================================================================')
lines.push('')
lines.push('begin;')
lines.push('')

for (const { template: t, items } of docs) {
  lines.push(`-- ---------------------------------------------------------------------------`)
  lines.push(`-- ${t.code}: ${t.name} (${items.filter((i) => i.kind === 'risk').length} risks, ${items.filter((i) => i.kind === 'control').length} controls)`)
  lines.push(`-- ---------------------------------------------------------------------------`)
  lines.push(`insert into public.icfr_templates (code, name, cycle, description, sort_order)`)
  lines.push(`values (${[q(t.code), q(t.name), q(t.cycle), q(t.description ?? null), q(t.sort_order ?? 0)].join(', ')})`)
  lines.push(`on conflict (code) do update set`)
  lines.push(`  name = excluded.name, cycle = excluded.cycle, description = excluded.description, sort_order = excluded.sort_order;`)
  lines.push('')

  lines.push(`insert into public.icfr_template_items (template_id, kind, ref, title, description, assertions, control_type, nature, frequency, is_key, level, coso_component, linked_risk_refs, sort_order)`)
  lines.push(`select t.id, i.* from public.icfr_templates t`)
  lines.push(`cross join (values`)
  lines.push(
    items
      .map(
        (i) =>
          `  (${[
            q(i.kind), q(i.ref), q(i.title), q(i.description), qArray(i.assertions),
            q(i.control_type), q(i.nature), q(i.frequency),
            i.is_key === null ? 'null::boolean' : q(i.is_key),
            q(i.level), q(i.coso_component), qArray(i.linked_risk_refs), q(i.sort_order),
          ].join(', ')})`
      )
      .join(',\n')
  )
  lines.push(`) as i(kind, ref, title, description, assertions, control_type, nature, frequency, is_key, level, coso_component, linked_risk_refs, sort_order)`)
  lines.push(`where t.code = ${q(t.code)}`)
  lines.push(`on conflict (template_id, ref) do update set`)
  lines.push(`  kind = excluded.kind, title = excluded.title, description = excluded.description,`)
  lines.push(`  assertions = excluded.assertions, control_type = excluded.control_type, nature = excluded.nature,`)
  lines.push(`  frequency = excluded.frequency, is_key = excluded.is_key, level = excluded.level,`)
  lines.push(`  coso_component = excluded.coso_component, linked_risk_refs = excluded.linked_risk_refs,`)
  lines.push(`  sort_order = excluded.sort_order;`)
  lines.push('')
  lines.push(`delete from public.icfr_template_items i`)
  lines.push(`using public.icfr_templates t`)
  lines.push(`where i.template_id = t.id and t.code = ${q(t.code)}`)
  lines.push(`  and i.ref not in (${items.map((i) => q(i.ref)).join(', ')});`)
  lines.push('')
}

lines.push('commit;')
lines.push('')

writeFileSync(OUT_FILE, lines.join('\n'))
console.log(`\n→ wrote ${OUT_FILE}`)
