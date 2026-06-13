import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Shield, TrendingUp, Globe, Zap } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6" />
            <span className="font-semibold text-lg tracking-tight">AETHER</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 text-xs text-muted-foreground mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live regulatory intelligence for GCC enterprises
        </div>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] mb-6">
          The risk horizon,<br />
          <span className="text-muted-foreground">in one platform.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          AI-powered risk intelligence built for consulting firms and enterprises across Saudi Arabia, Qatar, Jordan, and the UAE.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/signup">
            <Button size="lg" className="h-12 px-6">Start free trial</Button>
          </Link>
          <Link href="/demo">
            <Button size="lg" variant="outline" className="h-12 px-6">Book a demo</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-3 gap-6">
        <FeatureCard
          icon={<Globe className="w-5 h-5" />}
          title="Built for the GCC"
          description="Native coverage of SAMA, NCA, QCB, NCSA, CBJ — in English and Arabic."
        />
        <FeatureCard
          icon={<TrendingUp className="w-5 h-5" />}
          title="Continuous intelligence"
          description="Regulatory changes, geopolitical signals, and sector incidents — analyzed in real time."
        />
        <FeatureCard
          icon={<Zap className="w-5 h-5" />}
          title="Modular by design"
          description="Risk horizon today. AI governance, policy management, and audit trail next."
        />
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8 text-sm text-muted-foreground flex items-center justify-between">
          <span>© 2026 AETHER. Built in the GCC.</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-6 rounded-xl border border-border/60 bg-card hover:border-border transition-colors">
      <div className="w-10 h-10 rounded-lg bg-foreground/5 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-medium mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}