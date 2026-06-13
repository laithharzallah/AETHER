import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const MODELS = {
  SONNET: 'claude-sonnet-4-5',
  HAIKU: 'claude-haiku-4-5',
  OPUS: 'claude-opus-4-5',
} as const
