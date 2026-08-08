'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { dashboardNavItems } from '@/lib/dashboard/nav'
import { cn } from '@/lib/utils'

/**
 * Horizontally scrollable module strip for narrow screens, where the sidebar is
 * hidden. A strip rather than a drawer: the module list is long enough that a
 * drawer would need its own scrolling anyway, and this keeps the current module
 * visible instead of hiding navigation behind a tap.
 */
export function DashboardMobileNav({
  enabledModules,
}: {
  enabledModules: string[]
}) {
  const pathname = usePathname()
  const enabled = new Set(enabledModules)

  const items = dashboardNavItems.filter(
    (item) => !item.moduleSlug || enabled.has(item.moduleSlug)
  )

  return (
    <nav
      aria-label="Modules"
      className="flex gap-1 overflow-x-auto border-b border-border/40 px-3 py-2 md:hidden"
    >
      {items.map((item) => {
        const active =
          item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors',
              active
                ? 'bg-foreground/5 font-medium text-foreground'
                : 'text-muted-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
