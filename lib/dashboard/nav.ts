import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderLock,
  LayoutDashboard,
  Scale,
  ScrollText,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'

export type DashboardNavItem = {
  label: string
  href: string
  icon: LucideIcon
  comingSoon?: boolean
  section?: string
}

export const dashboardNavItems: DashboardNavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Ask AETHER', href: '/dashboard/assistant', icon: Sparkles },

  { label: 'Programs', href: '/dashboard/programs', icon: ClipboardCheck, section: 'Compliance' },
  { label: 'Evidence', href: '/dashboard/evidence', icon: FolderLock, section: 'Compliance' },
  { label: 'Policies', href: '/dashboard/policies', icon: ScrollText, section: 'Compliance' },
  { label: 'Policy Generator', href: '/dashboard/policy-generator', icon: FileText, section: 'Compliance' },

  { label: 'ICFR', href: '/dashboard/icfr', icon: Scale, section: 'Financial controls' },

  { label: 'Regulatory Library', href: '/dashboard/regulations', icon: BookOpen, section: 'Intelligence' },
  { label: 'Risk Horizon', href: '/dashboard/risk-horizon', icon: ShieldAlert, section: 'Intelligence', comingSoon: true },
  { label: 'Audit Trail', href: '/dashboard/audit', icon: ClipboardList, section: 'Intelligence', comingSoon: true },
]
