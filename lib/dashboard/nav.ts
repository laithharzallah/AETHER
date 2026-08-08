import type { LucideIcon } from 'lucide-react'
import {
  Boxes,
  BrainCircuit,
  CalendarClock,
  ClipboardList,
  Cpu,
  LayoutDashboard,
  Radar,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'

export type DashboardNavItem = {
  label: string
  href: string
  icon: LucideIcon
  description?: string
  /** Slug in `modules`, so the sidebar reflects the tenant's entitlements. */
  moduleSlug?: string
}

export type DashboardNavGroup = {
  label: string
  items: DashboardNavItem[]
}

export const dashboardNav: DashboardNavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Overview',
        href: '/dashboard',
        icon: LayoutDashboard,
        description: 'Posture, directives and what needs attention now.',
      },
      {
        label: 'The Machine',
        href: '/dashboard/machine',
        icon: BrainCircuit,
        moduleSlug: 'machine',
        description:
          'The autonomous engine: what it read, what it concluded, and what it wants done.',
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        label: 'Risk Horizon',
        href: '/dashboard/risk-horizon',
        icon: Radar,
        moduleSlug: 'risk-horizon',
        description:
          'Regulatory and threat intelligence, scored for relevance to your organization.',
      },
    ],
  },
  {
    label: 'Governance',
    items: [
      {
        label: 'Policies',
        href: '/dashboard/policies',
        icon: ScrollText,
        moduleSlug: 'policies',
        description: 'Policy lifecycle, versions, approvals and framework coverage.',
      },
      {
        label: 'Policy Generator',
        href: '/dashboard/policy-generator',
        icon: Sparkles,
        moduleSlug: 'policy-generator',
        description:
          'Draft board-grade policies against the frameworks that apply to you.',
      },
      {
        label: 'Compliance',
        href: '/dashboard/compliance',
        icon: ShieldCheck,
        moduleSlug: 'compliance',
        description: 'Control library and coverage across every applicable framework.',
      },
    ],
  },
  {
    label: 'Risk',
    items: [
      {
        label: 'Risk Register',
        href: '/dashboard/risks',
        icon: TriangleAlert,
        moduleSlug: 'risk-register',
        description: 'Inherent and residual scoring with treatment plans.',
      },
      {
        label: 'Obligations',
        href: '/dashboard/obligations',
        icon: CalendarClock,
        moduleSlug: 'obligations',
        description: 'The compliance calendar, with owners, deadlines and evidence.',
      },
      {
        label: 'AI Governance',
        href: '/dashboard/ai-governance',
        icon: Cpu,
        moduleSlug: 'ai-governance',
        description: 'AI inventory with EU AI Act and SDAIA risk classification.',
      },
      {
        label: 'Third Parties',
        href: '/dashboard/vendors',
        icon: Boxes,
        moduleSlug: 'third-party',
        description: 'Vendor inventory, criticality and assessment status.',
      },
    ],
  },
  {
    label: 'Assurance',
    items: [
      {
        label: 'Audit Trail',
        href: '/dashboard/audit',
        icon: ClipboardList,
        moduleSlug: 'audit-trail',
        description: 'Tamper-evident, hash-chained record of every action.',
      },
      {
        label: 'Settings',
        href: '/dashboard/settings',
        icon: Settings,
        description: 'Organization, frameworks and autonomous engine configuration.',
      },
    ],
  },
]

export const dashboardNavItems: DashboardNavItem[] = dashboardNav.flatMap(
  (group) => group.items
)
