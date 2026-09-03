import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Sparkles,
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
    label: 'Ask AETHER',
    href: '/dashboard/assistant',
    icon: Sparkles,
  },
  {
    label: 'Regulatory Library',
    href: '/dashboard/regulations',
    icon: BookOpen,
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
  },
  {
    label: 'Audit Trail',
    href: '/dashboard/audit',
    icon: ClipboardList,
    comingSoon: true,
  },
]
