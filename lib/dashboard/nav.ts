import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  FileText,
  FolderLock,
  Gauge,
  LayoutDashboard,
  ListChecks,
  ListTree,
  Network,
  Radar,
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

  { label: 'Internal Audit', href: '/dashboard/audit', icon: ClipboardCheck, section: 'Assurance' },
  { label: 'Audit Universe', href: '/dashboard/audit/universe', icon: Network, section: 'Assurance' },
  { label: 'Observations', href: '/dashboard/audit/observations', icon: AlertTriangle, section: 'Assurance' },
  { label: 'Actions', href: '/dashboard/audit/actions', icon: ListChecks, section: 'Assurance' },

  { label: 'Enterprise Risk', href: '/dashboard/erm', icon: Radar, section: 'Risk' },
  { label: 'Risk Register', href: '/dashboard/erm/risks', icon: ListTree, section: 'Risk' },
  { label: 'Appetite', href: '/dashboard/erm/appetite', icon: Gauge, section: 'Risk' },
  { label: 'KRIs', href: '/dashboard/erm/kris', icon: Activity, section: 'Risk' },

  { label: 'Regulatory Library', href: '/dashboard/regulations', icon: BookOpen, section: 'Intelligence' },
  { label: 'Risk Horizon', href: '/dashboard/risk-horizon', icon: ShieldAlert, section: 'Intelligence', comingSoon: true },
]
