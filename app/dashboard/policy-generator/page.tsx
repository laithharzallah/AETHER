import { PolicyGeneratorClient } from '@/components/policy-generator/policy-generator-client'
import { listFrameworks } from '@/lib/regulatory-library/queries'
import { FRAMEWORKS } from '@/lib/policy-generator/constants'

export const dynamic = 'force-dynamic'

export default async function PolicyGeneratorPage() {
  const library = await listFrameworks()

  // Prefer the live library; fall back to the static list if it is not seeded.
  const frameworkOptions =
    library.length > 0
      ? library.map((f) => ({
          code: f.code ?? '',
          label: f.short_name ?? f.code ?? '',
          jurisdiction: f.jurisdiction ?? 'INTL',
          controlCount: f.control_count ?? 0,
        }))
      : FRAMEWORKS.map((f) => ({
          code: f.code,
          label: f.label,
          jurisdiction: f.jurisdiction,
          controlCount: 0,
        }))

  return (
    <PolicyGeneratorClient
      frameworkOptions={frameworkOptions}
      libraryAvailable={library.length > 0}
    />
  )
}
