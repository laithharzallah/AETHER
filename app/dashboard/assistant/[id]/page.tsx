import { notFound } from 'next/navigation'
import { AssistantClient } from '@/components/assistant/assistant-client'
import { getConversation, listConversations } from '@/lib/assistant/queries'
import { getLibraryStats } from '@/lib/regulatory-library/queries'

export const dynamic = 'force-dynamic'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [conversations, result, stats] = await Promise.all([
    listConversations(),
    getConversation(id),
    getLibraryStats(),
  ])

  if (!result) notFound()

  return (
    <AssistantClient
      key={result.conversation.id}
      conversations={conversations}
      activeConversation={result.conversation}
      initialMessages={result.messages}
      libraryStats={stats}
    />
  )
}
