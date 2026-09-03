import { AssistantClient } from '@/components/assistant/assistant-client'
import { listConversations } from '@/lib/assistant/queries'
import { getLibraryStats } from '@/lib/regulatory-library/queries'

export const dynamic = 'force-dynamic'

export default async function AssistantPage() {
  const [conversations, stats] = await Promise.all([listConversations(), getLibraryStats()])

  return (
    <AssistantClient
      key={'new'}
      conversations={conversations}
      activeConversation={null}
      initialMessages={[]}
      libraryStats={stats}
    />
  )
}
