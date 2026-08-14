import Link from 'next/link'
import { Bell, Shield } from 'lucide-react'
import { logout } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/dashboard/pills'
import { countryName, humanize } from '@/lib/dashboard/format'
import type { DashboardContext } from '@/lib/dashboard/get-dashboard-context'

export function DashboardTopBar({ context }: { context: DashboardContext }) {
  const subtitle = [
    context.orgCountry ? countryName(context.orgCountry) : null,
    context.orgIndustry ? humanize(context.orgIndustry) : null,
  ].filter(Boolean)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/40 px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Shield className="h-5 w-5 shrink-0 md:hidden" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {context.orgName ?? 'Your organization'}
          </p>
          {subtitle.length > 0 && (
            <p className="truncate text-xs text-muted-foreground">
              {subtitle.join(' · ')}
            </p>
          )}
        </div>
        {context.role === 'auditor' && (
          <Pill tone="info" title="Auditors have read-only access across the tenant.">
            read-only
          </Pill>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-4">
        <Link
          href="/dashboard/notifications"
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          aria-label={
            context.unreadNotifications > 0
              ? `Notifications, ${context.unreadNotifications} unread`
              : 'Notifications'
          }
        >
          <Bell className="h-4 w-4" />
          {context.unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-medium text-white tabular-nums">
              {context.unreadNotifications > 9 ? '9+' : context.unreadNotifications}
            </span>
          )}
        </Link>

        <p className="hidden max-w-[180px] truncate text-sm text-muted-foreground lg:block">
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
