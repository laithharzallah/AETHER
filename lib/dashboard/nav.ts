import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  ScrollText,
  ShieldAlert,
} from 'lucide-react'

export type DashboardNavItem = {
  label: string
  href: string
  icon: LucideIcon
  comingSoon?: boolean
}

export const dashboardNavItems: DashboardNavItem[] = [
  {
    label: 'Overview',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Risk Horizon',
    href: '/dashboard/risk-horizon',
    icon: ShieldAlert,
    comingSoon: true,
  },
  {
    label: 'Policy Generator',
    href: '/dashboard/policy-generator',
    icon: FileText,
  },
  {
    label: 'Policies',
    href: '/dashboard/policies',
    icon: ScrollText,
    comingSoon: true,
  },
  {
    label: 'Audit Trail',
    href: '/dashboard/audit',
    icon: ClipboardList,
    comingSoon: true,
  },
]
