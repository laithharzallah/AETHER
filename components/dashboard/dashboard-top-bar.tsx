import { logout } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import type { DashboardContext } from '@/lib/dashboard/get-dashboard-context'

type DashboardTopBarProps = {
  context: DashboardContext
}

export function DashboardTopBar({ context }: DashboardTopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {context.orgName ?? 'Your organization'}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <p className="hidden truncate text-sm text-muted-foreground sm:block">
          {context.email}
        </p>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  )
}
