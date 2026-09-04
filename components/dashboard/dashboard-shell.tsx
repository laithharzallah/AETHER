import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'
import { DashboardTopBar } from '@/components/dashboard/dashboard-top-bar'
import type { DashboardContext } from '@/lib/dashboard/get-dashboard-context'

type DashboardShellProps = {
  context: DashboardContext
  children: React.ReactNode
}

export function DashboardShell({ context, children }: DashboardShellProps) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <DashboardSidebar context={context} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopBar context={context} />
        <main className="scrollbar-thin flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
