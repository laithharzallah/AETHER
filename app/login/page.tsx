import Link from 'next/link'
import { AuthLayout } from '@/components/auth/auth-layout'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Your programs, evidence and library are where you left them."
      footer={
        <>
          New to AETHER?{' '}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Request access
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthLayout>
  )
}
