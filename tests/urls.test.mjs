import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../lib/security/urls.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
})
const { safeRedirectPath, safeExternalUrl } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)

test('callback preserves a local destination and query', () => {
  assert.equal(safeRedirectPath('/dashboard/programs?status=active#summary'), '/dashboard/programs?status=active#summary')
})

test('callback rejects authority, scheme, backslash and control-character attacks', () => {
  for (const value of [null, 42, {}, '@evil.example', '//evil.example', 'https://evil.example', '/\\evil.example', '/\nevil.example', 'javascript:alert(1)']) {
    assert.equal(safeRedirectPath(value), '/dashboard')
  }
})

test('external evidence allows HTTP(S) with encoded paths', () => {
  assert.equal(safeExternalUrl('https://example.org/a%20b?version=2'), 'https://example.org/a%20b?version=2')
  assert.equal(safeExternalUrl('http://example.org/report'), 'http://example.org/report')
})

test('external evidence rejects executable URLs, credentials and malformed URLs', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', '//evil.example', 'https://trusted.example@evil.example', 'https://example.org\\@evil.example', 'https://exa\nmple.org', '', null, {}]) {
    assert.equal(safeExternalUrl(value), null)
  }
})
