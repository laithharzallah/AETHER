'use client'

import { useActionState } from 'react'
import { signup, type AuthState } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: AuthState = {}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState)

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p
          className="rounded-md border border-danger/30 bg-danger/8 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {state.error}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" type="text" autoComplete="name" required className="h-10" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="organizationName">Organization</Label>
          <Input id="organizationName" name="organizationName" type="text" required className="h-10" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? 'Creating your workspace…' : 'Create workspace'}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        By continuing you agree to the Terms and acknowledge the Privacy Policy. Your data
        stays in your organization&apos;s tenant.
      </p>
    </form>
  )
}
