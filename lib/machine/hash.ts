import { createHash } from 'node:crypto'

/**
 * Hex SHA-256. Matches `public.sha256_hex` in the database exactly, so a hash
 * computed here and one computed in SQL are interchangeable — which is what lets
 * the audit chain be extended from either side and still verify.
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/** Short, human-quotable digest for logs and dedupe keys. */
export function shortHash(input: string, length = 16): string {
  return sha256Hex(input).slice(0, length)
}
