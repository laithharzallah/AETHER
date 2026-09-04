import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { Toaster } from '@/components/ui/sonner'
import { getDashboardContext } from '@/lib/dashboard/get-dashboard-context'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const context = await getDashboardContext()

  return (
    <>
      <DashboardShell context={context}>{children}</DashboardShell>
      <Toaster position="bottom-right" />
    </>
  )
}
