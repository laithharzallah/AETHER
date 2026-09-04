import Link from 'next/link'
import { AuthLayout } from '@/components/auth/auth-layout'
import { SignupForm } from './signup-form'

export const metadata = { title: 'Request access' }

export default function SignupPage() {
  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Start your organization on AETHER. You'll be the owner; invite your team later."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthLayout>
  )
}
