import Link from 'next/link'
import { Shield } from 'lucide-react'
import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/40 px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <Shield className="w-5 h-5" />
          <span className="font-semibold tracking-tight">AETHER</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <LoginForm />
      </main>
    </div>
  )
}
