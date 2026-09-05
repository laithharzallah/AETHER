import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { NextRequest, NextResponse } = require('next/server')
const source = await readFile(new URL('../proxy.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})

function loadProxy(updateSession) {
  const exports = {}
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      if (name === 'next/server') return { NextRequest, NextResponse }
      if (name === '@/lib/supabase/middleware') return { updateSession }
      throw new Error(`Unexpected test import: ${name}`)
    },
  })
  return exports.proxy
}

function refreshedResponse() {
  const response = NextResponse.next()
  response.cookies.set('test-session', 'rotated', { httpOnly: true, secure: true, path: '/', sameSite: 'lax' })
  return response
}

test('authenticated login redirect preserves rotated cookie attributes', async () => {
  const proxy = loadProxy(async () => ({ user: { id: 'test' }, supabaseResponse: refreshedResponse() }))
  const response = await proxy(new NextRequest('https://aether.example/login'))
  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), 'https://aether.example/dashboard')
  assert.match(response.headers.get('set-cookie'), /test-session=rotated/)
  assert.match(response.headers.get('set-cookie'), /HttpOnly/)
  assert.match(response.headers.get('set-cookie'), /Secure/)
})

test('unauthenticated page redirect and API denial preserve session updates', async () => {
  const proxy = loadProxy(async () => ({ user: null, supabaseResponse: refreshedResponse() }))
  const page = await proxy(new NextRequest('https://aether.example/dashboard'))
  assert.equal(page.headers.get('location'), 'https://aether.example/login')
  const api = await proxy(new NextRequest('https://aether.example/api/assistant'))
  assert.equal(api.status, 401)
  assert.deepEqual(await api.json(), { error: 'Unauthorized' })
  for (const response of [page, api]) assert.match(response.headers.get('set-cookie'), /test-session=rotated/)
})

test('session failure fails closed with JSON for APIs and redirect for pages', async () => {
  const proxy = loadProxy(async () => { throw new Error('Auth unavailable') })
  const api = await proxy(new NextRequest('https://aether.example/api/assistant'))
  assert.equal(api.status, 401)
  assert.deepEqual(await api.json(), { error: 'Unauthorized' })
  const page = await proxy(new NextRequest('https://aether.example/dashboard'))
  assert.equal(page.headers.get('location'), 'https://aether.example/login')
  const login = await proxy(new NextRequest('https://aether.example/login'))
  assert.equal(login.status, 200)
})

test('health probe does not depend on authentication', async () => {
  const proxy = loadProxy(async () => { assert.fail('Health should not call Auth') })
  assert.equal((await proxy(new NextRequest('https://aether.example/api/health'))).status, 200)
})
