import Anthropic from '@anthropic-ai/sdk'

/**
 * The Anthropic constructor throws when no API key is present, so building the
 * client at module scope took the whole process down on import — including routes
 * that never call the model. The Machine has to keep running without a key (it
 * falls back to heuristic analysis), so construction is deferred and the
 * capability is checkable.
 */

let client: Anthropic | null = null

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

export class MissingAnthropicKeyError extends Error {
  constructor() {
    super(
      'ANTHROPIC_API_KEY is not set. Set it in the environment to enable AI-assisted features.'
    )
    this.name = 'MissingAnthropicKeyError'
  }
}

export function getAnthropicClient(): Anthropic {
  if (!hasAnthropicKey()) {
    throw new MissingAnthropicKeyError()
  }

  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      maxRetries: 2,
    })
  }

  return client
}

/**
 * Lazy handle so call sites can read like a client while construction still
 * happens on first use rather than on import.
 */
export const anthropic = new Proxy({} as Anthropic, {
  get(_target, property) {
    return Reflect.get(getAnthropicClient(), property)
  },
})

export const MODELS = {
  SONNET: 'claude-sonnet-4-5',
  HAIKU: 'claude-haiku-4-5',
  OPUS: 'claude-opus-4-5',
} as const

export type ModelId = (typeof MODELS)[keyof typeof MODELS]
