import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

// Exercise the production build without any real account or provider credentials.
const origin = 'http://127.0.0.1:3028'
const server = spawn(process.execPath, [
  'node_modules/next/dist/bin/next', 'start', '--port', '3028', '--hostname', '127.0.0.1',
], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
    SUPABASE_SECRET_KEY: 'sb_secret_test_only',
    ANTHROPIC_API_KEY: 'test-only-not-a-real-key',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Startup timeout')), 15000)
    server.stdout.on('data', (data) => {
      if (data.toString().includes('Ready')) {
        clearTimeout(timer)
        resolve()
      }
    })
    server.on('error', (error) => { clearTimeout(timer); reject(error) })
    server.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}`)) })
  })

  for (const [path, method, status] of [
    ['/api/health', 'GET', 200],
    ['/login', 'GET', 200],
    ['/signup', 'GET', 200],
    ['/dashboard', 'GET', 307],
    ['/api/assistant', 'POST', 401],
    ['/api/generate-policy', 'POST', 401],
    ['/auth/callback?next=%40evil.example', 'GET', 307],
  ]) {
    const response = await fetch(origin + path, {
      method, redirect: 'manual', signal: AbortSignal.timeout(10000),
    })
    assert.equal(response.status, status, path)
    if (path === '/dashboard') {
      assert.equal(new URL(response.headers.get('location'), origin).pathname, '/login')
    }
    if (path.startsWith('/auth/')) {
      // Next normalizes the route-handler request origin to localhost in this
      // local server. Require a loopback login destination, never user input.
      const destination = new URL(response.headers.get('location'), origin)
      assert.ok(['localhost', '127.0.0.1'].includes(destination.hostname))
      assert.equal(destination.port, '3028')
      assert.equal(destination.pathname, '/login')
    }
    console.log(`${method} ${path}: PASS (${status})`)
  }
} finally {
  server.kill('SIGTERM')
}
