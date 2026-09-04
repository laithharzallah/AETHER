import Link from 'next/link'
import { Wordmark } from '@/components/brand/logo'

const POINTS = [
  'SAMA CSF, NCA ECC and PDPL as structured, bilingual controls',
  'Programs, evidence and policies that trace to a regulation',
  'ICFR the way the Big Four run it — COSO, assertions, key controls',
  'An AI advisor that cites the control it read',
]

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-ink text-ink-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-60" />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 80% 10%, oklch(0.74 0.11 78 / 22%) 0%, transparent 60%), radial-gradient(50% 40% at 10% 100%, oklch(0.55 0.12 250 / 18%) 0%, transparent 60%)',
          }}
        />
        <Link href="/" className="relative" aria-label="AETHER home">
          <Wordmark inverted />
        </Link>
        <div className="relative max-w-md">
          <p className="eyebrow text-brass">GRC for the GCC</p>
          <h2 className="display mt-4 text-4xl text-balance">
            The regulator&apos;s requirements, your program, one system of record.
          </h2>
          <ul className="mt-8 space-y-3 text-sm text-ink-foreground/75">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-ink-foreground/50">
          Built in Al Khobar, for the GCC. © 2026 AETHER.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 lg:hidden">
          <Link href="/" aria-label="AETHER home">
            <Wordmark />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            <h1 className="display text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
