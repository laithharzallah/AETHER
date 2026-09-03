import { Instrument_Serif } from 'next/font/google'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { Toaster } from '@/components/ui/sonner'
import { getDashboardContext } from '@/lib/dashboard/get-dashboard-context'

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
})

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const context = await getDashboardContext()

  return (
    <div className={instrumentSerif.variable}>
      <DashboardShell context={context}>{children}</DashboardShell>
      <Toaster position="bottom-right" />
    </div>
  )
}
