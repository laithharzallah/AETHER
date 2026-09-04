'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Settings } from 'lucide-react'
import { Wordmark } from '@/components/brand/logo'
import { dashboardNavItems } from '@/lib/dashboard/nav'
import type { DashboardContext } from '@/lib/dashboard/get-dashboard-context'
import { logout } from '@/lib/actions/auth'
import { cn } from '@/lib/utils'

function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function initials(name: string | null, email: string) {
  const source = name?.trim() || email
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'A'
}

export function DashboardSidebar({ context }: { context: DashboardContext }) {
  const pathname = usePathname()

  return (
    <aside className="relative flex h-full w-[248px] shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      {/* Subtle brass glow at the top edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background:
            'radial-gradient(80% 60% at 30% 0%, oklch(0.74 0.11 78 / 14%) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex h-14 items-center border-b border-sidebar-border px-5">
        <Link href="/dashboard" className="flex items-center">
          <Wordmark inverted />
        </Link>
      </div>

      <nav className="scrollbar-thin relative flex-1 overflow-y-auto px-3 py-3">
        {dashboardNavItems.map((item, index) => {
          const prev = dashboardNavItems[index - 1]
          const showSection = item.section && item.section !== prev?.section
          const active = !item.comingSoon && isActivePath(pathname, item.href)
          const Icon = item.icon

          return (
            <div key={item.href}>
              {showSection && (
                <p className="mt-5 mb-1.5 px-3 text-[10px] font-medium tracking-[0.16em] text-sidebar-muted uppercase">
                  {item.section}
                </p>
              )}
              {item.comingSoon ? (
                <div
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-[13px] text-sidebar-muted/70"
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-60" />
                  <span className="flex-1">{item.label}</span>
                  <span className="rounded-full border border-sidebar-border px-1.5 py-px text-[9px] tracking-wider uppercase">
                    Soon
                  </span>
                </div>
              ) : (
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors',
                    active
                      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                      : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-opacity',
                      active ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      active ? 'text-sidebar-primary' : 'text-sidebar-muted group-hover:text-sidebar-foreground'
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              )}
            </div>
          )
        })}
      </nav>

      <div className="relative border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-[12px] font-semibold text-sidebar-primary-foreground">
            {initials(context.fullName, context.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-sidebar-foreground">
              {context.fullName ?? context.email}
            </p>
            <p className="truncate text-[11px] text-sidebar-muted">
              {context.orgName ?? 'Your organization'} · {context.role}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Settings"
              className="rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              title="Settings (coming soon)"
            >
              <Settings className="h-4 w-4" />
            </button>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Sign out"
                className="rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  )
}
