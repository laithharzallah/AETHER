'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function deleteConversation(conversationId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('conversations').delete().eq('id', conversationId)
  if (error) {
    console.error('[deleteConversation]', error)
    throw new Error('Could not delete conversation.')
  }
  revalidatePath('/dashboard/assistant')
  redirect('/dashboard/assistant')
}

export async function renameConversation(
  conversationId: string,
  title: string
): Promise<{ ok: boolean; error?: string }> {
  const clean = title.trim().slice(0, 120)
  if (!clean) return { ok: false, error: 'Title cannot be empty.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('conversations')
    .update({ title: clean })
    .eq('id', conversationId)
  if (error) {
    console.error('[renameConversation]', error)
    return { ok: false, error: 'Could not rename conversation.' }
  }
  revalidatePath('/dashboard/assistant')
  revalidatePath(`/dashboard/assistant/${conversationId}`)
  return { ok: true }
}
