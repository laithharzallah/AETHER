import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FolderLock,
  Languages,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Wordmark } from '@/components/brand/logo'
import { cn } from '@/lib/utils'

const REGULATORS = [
  'SAMA CSF',
  'NCA ECC',
  'Saudi PDPL',
  'CBUAE · UAE IAS',
  'QCB',
  'Qatar NIA',
  'CBJ',
  'ISO/IEC 27001',
  'NIST CSF 2.0',
  'EU AI Act',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ------------------------------------------------------------ nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ink/85 text-ink-foreground backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" aria-label="AETHER home">
            <Wordmark inverted />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-ink-foreground/75 md:flex">
            <a href="#platform" className="transition-colors hover:text-ink-foreground">
              Platform
            </a>
            <a href="#library" className="transition-colors hover:text-ink-foreground">
              Regulatory library
            </a>
            <a href="#icfr" className="transition-colors hover:text-ink-foreground">
              ICFR
            </a>
            <a href="#consulting" className="transition-colors hover:text-ink-foreground">
              For consulting firms
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm text-ink-foreground/80 transition-colors hover:text-ink-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brass px-4 text-sm font-medium text-brass-foreground transition-colors hover:bg-brass/90"
            >
              Request access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <div aria-hidden="true" className="bg-grid absolute inset-0 opacity-60" />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(70% 55% at 75% 20%, oklch(0.74 0.11 78 / 22%) 0%, transparent 60%), radial-gradient(50% 40% at 15% 90%, oklch(0.55 0.12 250 / 18%) 0%, transparent 60%)',
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pt-20 pb-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-28 lg:pb-32">
          <div>
            <p className="eyebrow text-brass">Governance · Risk · Compliance · Built for the GCC</p>
            <h1 className="display mt-5 text-5xl text-balance md:text-6xl lg:text-7xl">
              Compliance that speaks{' '}
              <em className="text-brass italic">SAMA, NCA and PDPL</em>{' '}
              natively.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-foreground/75">
              AETHER puts every GCC regulation inside your compliance program as
              structured, bilingual controls — then runs your programs, evidence,
              policies and ICFR on top of it, with an AI advisor that cites the
              control it read.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-brass px-5 text-sm font-medium text-brass-foreground transition-colors hover:bg-brass/90"
              >
                Request access
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-md border border-white/15 px-5 text-sm text-ink-foreground transition-colors hover:bg-white/5"
              >
                Sign in
              </Link>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-8">
              <Metric value="615" label="Controls, EN / AR" />
              <Metric value="10" label="Frameworks, 5 jurisdictions" />
              <Metric value="7" label="ICFR cycle templates" />
            </dl>
          </div>

          <ProductMock />
        </div>

        {/* regulator strip */}
        <div className="relative border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-5 text-[12px] tracking-[0.14em] text-ink-foreground/55 uppercase">
            <span className="text-ink-foreground/40">Coverage</span>
            {REGULATORS.map((r) => (
              <span key={r}>{r}</span>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- platform */}
      <section id="platform" className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">The platform</p>
          <h2 className="display mt-3 text-4xl md:text-5xl">
            One system of record for regulatory obligations, controls and proof.
          </h2>
          <p className="page-lede">
            Most GRC tools were built for SOC 2 and bolted onto the region. AETHER
            starts from the regulators your board actually answers to.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={BookOpen}
            title="Regulatory Library"
            body="SAMA CSF, NCA ECC-2:2024, Saudi PDPL, UAE IA Standards, QCB, Qatar NIA, CBJ, ISO 27001:2022, NIST CSF 2.0 and the EU AI Act — control by control, in English and Arabic, with evidence expectations and fidelity flags."
          />
          <Feature
            icon={ClipboardCheck}
            title="Compliance Programs"
            body="Adopt any framework as a program. Every control gets a status, an owner, a due date and its evidence. Readiness is computed, not estimated. An AI readiness review tells you the top ten gaps and the next 90 days."
          />
          <Feature
            icon={FolderLock}
            title="Evidence Vault"
            body="Private, organization-scoped storage with validity dates, expiry alerts and a review workflow. Every file is linked to the controls it proves, so audit week is a filter, not a scramble."
          />
          <Feature
            icon={Sparkles}
            title="Ask AETHER"
            body="A GRC advisor that reads the library and your own policies before it answers. Crosswalks SAMA to NCA to ISO in one table, in Arabic if you ask in Arabic — and cannot cite a control it did not read."
          />
          <Feature
            icon={ShieldCheck}
            title="Policy Generator"
            body="Board-grade policies drafted against the real control index, with a mapping table auditors can follow. Saved with their control links, versioned, and reviewable in place."
          />
          <Feature
            icon={Languages}
            title="Bilingual by design"
            body="Arabic is a first-class language across the library, the assistant and the UI — not a translation layer added later."
          />
        </div>
      </section>

      {/* -------------------------------------------------------- library */}
      <section id="library" className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow">Regulatory library</p>
            <h2 className="display mt-3 text-4xl md:text-5xl">
              The regulation is data, not a PDF on a shared drive.
            </h2>
            <p className="page-lede">
              Each control carries its domain, requirement, the evidence an assessor
              expects, criticality, and an honest fidelity flag — paraphrased,
              structural or summarized — so you always know how close the text sits
              to the primary source.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                'NCA ECC-2:2024 — all 108 controls across 4 domains and 28 subdomains',
                'SAMA CSF — all 32 subdomains, 120 control considerations',
                'NIST CSF 2.0 — all 106 subcategories, six functions',
                'ISO/IEC 27001:2022 — all 93 Annex A controls',
                'SAMA CSF, Saudi PDPL and the EU AI Act at obligation level',
                'Trigram search across English and Arabic text',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <LibraryMock />
        </div>
      </section>

      {/* ------------------------------------------------------------ icfr */}
      <section id="icfr" className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <IcfrMock />
          <div>
            <p className="eyebrow">ICFR</p>
            <h2 className="display mt-3 text-4xl md:text-5xl">
              Internal control over financial reporting, the way the Big Four run it.
            </h2>
            <p className="page-lede">
              COSO 2013 components, financial-statement assertions, key-control
              flags, design and operating effectiveness testing with frequency-based
              sample sizes, and a deficiency log that knows the difference between a
              deficiency and a material weakness.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {['P2P', 'O2C', 'R2R', 'Payroll', 'Fixed assets', 'Treasury', 'ITGC'].map((c) => (
                <span key={c} className="pill pill-neutral justify-center">
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Seven importable cycle templates — 52 risks, 84 controls — or describe a
              process and let AETHER draft the risk-control matrix.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- consulting */}
      <section id="consulting" className="surface-ink mx-6 my-8 rounded-2xl lg:mx-auto lg:max-w-7xl">
        <div className="grid gap-10 px-8 py-16 lg:grid-cols-[1fr_auto] lg:items-center lg:px-14">
          <div className="max-w-2xl">
            <p className="eyebrow text-brass">For consulting firms</p>
            <h2 className="display mt-3 text-4xl text-balance md:text-5xl">
              Run every client&apos;s ECC, SAMA and ICFR engagement from one workbench.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-foreground/75">
              Multi-tenant from the first line of the schema. Bring your firm&apos;s
              methodology, white-label the output, and stop rebuilding the same
              spreadsheet for every assessment.
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-md bg-brass px-6 text-sm font-medium text-brass-foreground transition-colors hover:bg-brass/90"
          >
            Talk to us
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------------------- footer */}
      <footer className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-6 border-t border-border pt-8 text-sm text-muted-foreground md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="hidden md:inline">·</span>
            <span>Built in Al Khobar, for the GCC. © 2026 AETHER.</span>
          </div>
          <div className="flex gap-6">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------------ */

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="display text-4xl text-ink-foreground">{value}</dt>
      <dd className="mt-1 text-xs tracking-wide text-ink-foreground/60">{label}</dd>
    </div>
  )
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
}) {
  return (
    <div className="surface p-6 transition-shadow hover:shadow-[var(--shadow-raised)]">
      <div className="icon-tile">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-[17px] font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

/** A CSS-drawn rendering of the Programs screen — no screenshot dependency. */
function ProductMock() {
  const rows = [
    { ref: '2-2-3', title: 'Minimum IAM controls', status: 'Implemented', tone: 'success', owner: 'R. Al-Qahtani' },
    { ref: '2-4-2', title: 'Email protection controls', status: 'In progress', tone: 'warning', owner: 'S. Haddad' },
    { ref: '2-8-3', title: 'Cryptography — approved algorithms', status: 'Implemented', tone: 'success', owner: 'R. Al-Qahtani' },
    { ref: '2-12-3', title: 'Logging & monitoring, 12-month retention', status: 'Not started', tone: 'neutral', owner: '—' },
    { ref: '4-2-3', title: 'Cloud — data residency in the Kingdom', status: 'In progress', tone: 'warning', owner: 'M. Tukemun' },
  ] as const

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -inset-6 rounded-3xl opacity-60 blur-2xl"
        style={{ background: 'radial-gradient(60% 60% at 50% 40%, oklch(0.74 0.11 78 / 25%), transparent 70%)' }}
      />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-card text-foreground shadow-[var(--shadow-overlay)]">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="ml-3 text-[11px] text-muted-foreground">aether · Programs · NCA ECC-2:2024</span>
        </div>
        <div className="p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">Compliance program</p>
              <p className="display mt-1 text-xl">NCA ECC-2:2024 — Group IT</p>
            </div>
            <div className="text-right">
              <p className="display text-3xl">61%</p>
              <p className="text-[11px] text-muted-foreground">readiness</p>
            </div>
          </div>
          <div className="meter mt-3">
            <span style={{ width: '61%' }} />
          </div>
          <div className="mt-1.5 flex gap-4 text-[11px] text-muted-foreground tabular-nums">
            <span>64 implemented</span>
            <span>19 in progress</span>
            <span>23 not started</span>
            <span>2 N/A</span>
          </div>
          <table className="data-table mt-4 text-[12px]">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Control</th>
                <th>Status</th>
                <th className="hidden sm:table-cell">Owner</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ref}>
                  <td className="font-mono text-[11px] whitespace-nowrap">{r.ref}</td>
                  <td>{r.title}</td>
                  <td>
                    <span className={cn('pill', `pill-${r.tone}`)}>{r.status}</span>
                  </td>
                  <td className="hidden text-muted-foreground sm:table-cell">{r.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function LibraryMock() {
  return (
    <div className="surface-raised overflow-hidden">
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">NCA ECC · Cybersecurity Defense</p>
            <p className="mt-1 font-medium">2-2-3 · Minimum IAM controls</p>
          </div>
          <span className="pill pill-danger">High</span>
        </div>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-border p-5 text-sm leading-relaxed md:border-r md:border-b-0">
          IAM requirements must cover at minimum: strong passwords, multi-factor
          authentication for remote access and privileged accounts, least privilege
          and segregation of duties, secure management of privileged, service and
          default accounts, and periodic review of identities and access rights.
        </div>
        <div dir="rtl" lang="ar" className="p-5 text-right text-sm leading-relaxed">
          يجب أن تغطي متطلبات إدارة الهويات والصلاحيات كحد أدنى: كلمات مرور قوية،
          والتحقق متعدد العناصر للدخول عن بُعد والحسابات ذات الصلاحيات الهامة، ومنح
          الصلاحيات وفق الحد الأدنى وفصل المهام، والإدارة الآمنة للحسابات ذات
          الصلاحيات الهامة وحسابات الخدمات، والمراجعة الدورية للهويات والصلاحيات.
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface px-5 py-3 text-[11px] text-muted-foreground">
        <span className="pill pill-neutral">Preventive</span>
        <span className="pill pill-neutral">Paraphrased</span>
        <span>Evidence: MFA coverage report · privileged account inventory · access review records</span>
      </div>
    </div>
  )
}

function IcfrMock() {
  const risks = ['R1 Fictitious vendors', 'R2 Duplicate payments', 'R3 Unrecorded liabilities', 'R4 Unauthorized POs']
  const controls = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']
  const links: Record<string, string[]> = {
    'R1 Fictitious vendors': ['C1', 'C6'],
    'R2 Duplicate payments': ['C3', 'C4'],
    'R3 Unrecorded liabilities': ['C5'],
    'R4 Unauthorized POs': ['C2', 'C6'],
  }
  return (
    <div className="surface-raised overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <p className="eyebrow">ICFR · Procure-to-Pay</p>
          <p className="mt-1 font-medium">Risk-control matrix</p>
        </div>
        <div className="flex gap-2">
          <span className="pill pill-success">9 key effective</span>
          <span className="pill pill-warning">1 deficiency</span>
        </div>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full text-[12px]">
          <thead>
            <tr>
              <th className="pb-2 text-left font-medium text-muted-foreground">Risk</th>
              {controls.map((c) => (
                <th key={c} className="pb-2 text-center font-mono font-medium text-muted-foreground">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {risks.map((r) => (
              <tr key={r} className="border-t border-border">
                <td className="py-2 pr-3">{r}</td>
                {controls.map((c) => (
                  <td key={c} className="py-2 text-center">
                    <span
                      className={cn(
                        'inline-block h-4 w-4 rounded-sm border',
                        links[r].includes(c) ? 'border-primary bg-primary' : 'border-border bg-surface'
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border bg-surface px-5 py-3 text-[11px] text-muted-foreground">
        <span>C1 Vendor master approval · Preventive · Key</span>
        <span>C3 Three-way match · Automated · Key</span>
        <span>C5 Accrual review · Detective · Monthly</span>
      </div>
    </div>
  )
}
