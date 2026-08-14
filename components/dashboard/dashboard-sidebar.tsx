'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield } from 'lucide-react'
import { dashboardNav } from '@/lib/dashboard/nav'
import { cn } from '@/lib/utils'

function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function DashboardSidebar({
  enabledModules,
}: {
  /**
   * Modules the tenant is entitled to. One that is not enabled is hidden rather
   * than shown disabled: an entitlement the reader cannot act on is noise in a
   * navigation list this long.
   */
  enabledModules: string[]
}) {
  const pathname = usePathname()
  const enabled = new Set(enabledModules)

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-border/40 bg-background md:flex">
      <div className="flex items-center gap-2 border-b border-border/40 px-5 py-5">
        <Shield className="h-5 w-5" />
        <span className="text-lg font-semibold tracking-tight">AETHER</span>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
        {dashboardNav.map((group) => {
          const visible = group.items.filter(
            (item) => !item.moduleSlug || enabled.has(item.moduleSlug)
          )
          if (visible.length === 0) return null

          return (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground/70 uppercase">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {visible.map((item) => {
                  const active = isActivePath(pathname, item.href)
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-foreground/5 font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
