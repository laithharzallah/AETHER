import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'
import { DashboardTopBar } from '@/components/dashboard/dashboard-top-bar'
import { DashboardMobileNav } from '@/components/dashboard/dashboard-mobile-nav'
import type { DashboardContext } from '@/lib/dashboard/get-dashboard-context'

export function DashboardShell({
  context,
  children,
}: {
  context: DashboardContext
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <DashboardSidebar enabledModules={context.enabledModules} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopBar context={context} />
        <DashboardMobileNav enabledModules={context.enabledModules} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
