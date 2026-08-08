import Link from 'next/link'
import { Bell } from 'lucide-react'
import { requireOrganization } from '@/lib/dashboard/get-dashboard-context'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/dashboard/empty-state'
import { SeverityPill } from '@/components/dashboard/pills'
import { MarkAllRead } from '@/components/dashboard/mark-all-read'
import { formatRelativeDays, humanize } from '@/lib/dashboard/format'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const context = await requireOrganization()
  const supabase = await createClient()

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, kind, severity, title, body, link, entity_type, read_at, created_at')
    .eq('organization_id', context.orgId)
    .eq('profile_id', context.userId)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = notifications ?? []
  const unread = rows.filter((n) => !n.read_at).length

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Notifications"
        description="Only high and urgent directives notify. Anything below that bar waits to be found in the console, because a tool that notifies about everything gets filtered into a folder nobody opens."
        actions={unread > 0 && context.canWrite ? <MarkAllRead /> : undefined}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing to report"
          description="You will be notified when the engine raises a high or urgent directive for your organization, and your role is on its notify list."
        />
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl ring-1 ring-foreground/10">
          {rows.map((notification) => {
            const body = (
              <div
                className={cn(
                  'flex items-start gap-3 bg-card p-4',
                  !notification.read_at && 'bg-foreground/[0.02]'
                )}
              >
                <div
                  className={cn(
                    'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                    notification.read_at ? 'bg-transparent' : 'bg-sky-500'
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityPill severity={notification.severity} />
                    <span className="text-xs text-muted-foreground">
                      {humanize(notification.kind)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDays(notification.created_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium">{notification.title}</p>
                  {notification.body && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {notification.body}
                    </p>
                  )}
                </div>
              </div>
            )

            return (
              <li key={notification.id}>
                {notification.link ? (
                  <Link
                    href={notification.link}
                    className="block transition-colors hover:bg-foreground/[0.03]"
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
