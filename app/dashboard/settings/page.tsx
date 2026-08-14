import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Pill } from '@/components/dashboard/pills'
import {
  FrameworkPicker,
  type FrameworkChoice,
} from '@/components/settings/framework-picker'
import {
  MachineSettingsForm,
  type MachineSettingsValues,
} from '@/components/settings/machine-settings-form'
import { countryName, humanize } from '@/lib/dashboard/format'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const context = await requireOrganization()
  const supabase = await createClient()

  const [frameworks, held, suggestions, settings, controlCounts, team] =
    await Promise.all([
      supabase
        .from('frameworks')
        .select(
          'code, name, short_name, regulator, jurisdiction, category, mandatory, control_count'
        )
        .order('code'),
      supabase
        .from('controls')
        .select('framework_code')
        .eq('organization_id', context.orgId)
        .limit(5000),
      supabase.rpc('suggested_frameworks', {
        p_country: context.orgCountry,
        p_industry: context.orgIndustry,
      }),
      supabase
        .from('machine_settings')
        .select(
          'enabled, autonomy_level, digest_cadence, min_relevance_to_alert, min_relevance_to_act'
        )
        .eq('organization_id', context.orgId)
        .maybeSingle(),
      supabase
        .from('framework_controls_expanded')
        .select('framework_code')
        .limit(5000),
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('organization_id', context.orgId)
        .order('role'),
    ])

  const heldCodes = new Set((held.data ?? []).map((row) => row.framework_code))

  // Actual catalogue depth per framework, rather than the published control count
  // — what matters here is how many controls provisioning will create.
  const catalogueCounts = (controlCounts.data ?? []).reduce<Record<string, number>>(
    (acc, row) => {
      if (row.framework_code) {
        acc[row.framework_code] = (acc[row.framework_code] ?? 0) + 1
      }
      return acc
    },
    {}
  )

  const suggestionRows = Array.isArray(suggestions.data)
    ? (suggestions.data as Array<{ framework_code: string; reason: string }>)
    : []
  const suggestionByCode = new Map(
    suggestionRows.map((row) => [row.framework_code, row.reason])
  )

  const choices: FrameworkChoice[] = (frameworks.data ?? [])
    .map((row) => ({
      code: row.code,
      name: row.name,
      shortName: row.short_name,
      regulator: row.regulator,
      jurisdiction: row.jurisdiction,
      category: row.category,
      mandatory: row.mandatory,
      controlCount: catalogueCounts[row.code] ?? 0,
      held: heldCodes.has(row.code),
      suggested: suggestionByCode.has(row.code) || heldCodes.has(row.code),
      suggestionReason: suggestionByCode.get(row.code) ?? null,
    }))
    .sort((a, b) => {
      if (a.held !== b.held) return a.held ? -1 : 1
      if (a.mandatory !== b.mandatory) return a.mandatory ? -1 : 1
      return a.code.localeCompare(b.code)
    })

  const machineValues: MachineSettingsValues = {
    enabled: settings.data?.enabled ?? true,
    autonomyLevel: settings.data?.autonomy_level ?? 'advise',
    digestCadence: settings.data?.digest_cadence ?? 'weekly',
    minRelevanceToAlert: settings.data?.min_relevance_to_alert ?? 0.35,
    minRelevanceToAct: settings.data?.min_relevance_to_act ?? 0.75,
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title="Settings"
        description="Organization profile, the frameworks you are assessed against, and what the autonomous engine is permitted to do unattended."
      />

      {!context.isAdmin && (
        <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
          You can view this configuration but not change it. Only an owner or admin can.
        </div>
      )}

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-sm font-medium">Organization</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="mt-0.5 font-medium">{context.orgName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Type</dt>
            <dd className="mt-0.5">{humanize(context.orgType)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Country</dt>
            <dd className="mt-0.5">{countryName(context.orgCountry)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Industry</dt>
            <dd className="mt-0.5">{humanize(context.orgIndustry)}</dd>
          </div>
        </dl>
        {(!context.orgCountry || !context.orgIndustry) && (
          <p className="mt-3 rounded-lg bg-amber-500/5 p-3 text-xs text-muted-foreground">
            Country and industry drive which frameworks apply and how a regulatory signal
            is scored for relevance. With either missing, the engine has to treat far more
            as potentially relevant than it should.
          </p>
        )}
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-sm font-medium">Frameworks</h2>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          Adding a framework instantiates its controls into your library and creates the
          obligations attached to it. Re-running is safe: nothing you already hold is
          duplicated.
        </p>
        <FrameworkPicker frameworks={choices} canEdit={context.isAdmin} />
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-sm font-medium">The Machine</h2>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          What the autonomous engine may do without being asked.
        </p>
        <MachineSettingsForm values={machineValues} canEdit={context.isAdmin} />
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-sm font-medium">Team</h2>
        <ul className="mt-3 divide-y divide-border/60">
          {(team.data ?? []).map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{member.full_name ?? member.email}</p>
                {member.full_name && (
                  <p className="truncate text-muted-foreground">{member.email}</p>
                )}
              </div>
              <Pill tone={member.role === 'auditor' ? 'info' : 'neutral'}>
                {member.role}
              </Pill>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
