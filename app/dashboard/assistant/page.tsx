import { AssistantClient } from '@/components/assistant/assistant-client'
import { listConversations } from '@/lib/assistant/queries'
import { getLibraryStats } from '@/lib/regulatory-library/queries'

export const dynamic = 'force-dynamic'

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const [{ q }, conversations, stats] = await Promise.all([
    searchParams,
    listConversations(),
    getLibraryStats(),
  ])

  return (
    <AssistantClient
      key={'new'}
      conversations={conversations}
      activeConversation={null}
      initialMessages={[]}
      libraryStats={stats}
      initialQuery={typeof q === 'string' ? q.slice(0, 2000) : undefined}
    />
  )
}
