'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronRight, Search, Sparkles } from 'lucide-react'
import { dashboardNavItems } from '@/lib/dashboard/nav'
import type { DashboardContext } from '@/lib/dashboard/get-dashboard-context'
import { cn } from '@/lib/utils'

type DashboardTopBarProps = {
  context: DashboardContext
}

function useBreadcrumb(pathname: string) {
  const match = dashboardNavItems
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]
  const isDetail = match && pathname !== match.href
  return { section: match?.section ?? null, label: match?.label ?? 'Overview', isDetail, href: match?.href }
}

export function DashboardTopBar({ context }: DashboardTopBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const crumb = useBreadcrumb(pathname)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/dashboard/assistant?q=${encodeURIComponent(q)}`)
    setQuery('')
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/80 px-6 backdrop-blur">
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumb.section && (
          <>
            <span className="hidden text-muted-foreground sm:inline">{crumb.section}</span>
            <ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground/60 sm:inline" />
          </>
        )}
        {crumb.isDetail && crumb.href ? (
          <>
            <Link href={crumb.href} className="text-muted-foreground hover:text-foreground">
              {crumb.label}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="truncate font-medium">Detail</span>
          </>
        ) : (
          <span className="truncate font-medium">{crumb.label}</span>
        )}
      </div>

      <form
        onSubmit={submit}
        className={cn(
          'hidden h-9 w-full max-w-md items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm transition-colors md:flex',
          'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30'
        )}
        role="search"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about any regulation, control or policy…"
          aria-label="Ask AETHER"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
        <span className="hidden items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground lg:inline-flex">
          <Sparkles className="h-3 w-3" />
          Ask AETHER
        </span>
      </form>

      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden truncate text-sm text-muted-foreground lg:inline">
          {context.orgName ?? 'Your organization'}
        </span>
        <span className="pill pill-brass">GCC edition</span>
      </div>
    </header>
  )
}
