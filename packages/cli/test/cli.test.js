import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CLI = new URL('../dist/cli.js', import.meta.url).pathname
const dir = mkdtempSync(join(tmpdir(), 'readly-test-'))
const outside = mkdtempSync(join(tmpdir(), 'readly-outside-'))
writeFileSync(join(outside, 'secret.txt'), 'top secret')
mkdirSync(join(dir, 'docs'))
writeFileSync(join(dir, 'README.md'), '# Hello\n\n![x](pic.svg) [d](docs/a.md)\n')
writeFileSync(join(dir, 'pic.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
writeFileSync(join(dir, 'docs', 'a.md'), '# Doc A\n')
writeFileSync(join(dir, '.env'), 'SECRET=1')
symlinkSync(outside, join(dir, 'escape'))

/** Spawns the CLI and resolves once it prints its URL. */
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args, '--no-open'], { cwd: dir })
    let out = ''
    child.stdout.on('data', (d) => {
      out += d
      const m = out.match(/http:\/\/localhost:(\d+)/)
      if (m) resolve({ child, url: m[0], port: Number(m[1]), out })
    })
    child.on('error', reject)
    child.on('exit', (code) => reject(new Error(`exited ${code}: ${out}`)))
  })
}

const servers = []
after(() =>
  servers.forEach((s) => {
    s.child.removeAllListeners('exit')
    s.child.kill()
  }),
)

let single, folder
before(async () => {
  single = await run(['README.md', '-p', '3400'])
  servers.push(single)
  folder = await run(['.', '-p', '3500'])
  servers.push(folder)
})

const get = (base, path, init) => fetch(base + path, init)

test('single file: renders at / with GitHub-style markup and no sidebar', async () => {
  const html = await (await get(single.url, '/')).text()
  assert.match(html, /<h1 id="hello">/)
  assert.match(html, /class="markdown-body"/)
  assert.ok(!html.includes('id="sidebar"'))
  assert.match(html, /data-theme="dark"/)
})

test('binds to 127.0.0.1 only', async () => {
  const res = await get(`http://127.0.0.1:${single.port}`, '/')
  assert.equal(res.status, 200)
})

test('serves relative assets from the file folder with correct type', async () => {
  const res = await get(single.url, '/pic.svg')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /svg/)
})

test('blocks traversal, dotfiles and symlink escapes', async () => {
  for (const p of ['/%2e%2e/%2e%2e/etc/passwd', '/..%2f..%2fetc/passwd', '/.env', '/escape/secret.txt']) {
    const res = await get(single.url, p)
    assert.equal(res.status, 404, p)
  }
  // raw (non-normalised) request line
  const raw = await new Promise((resolve) => {
    import('node:net').then(({ createConnection }) => {
      const s = createConnection(single.port, '127.0.0.1', () =>
        s.write(`GET /../../../../etc/passwd HTTP/1.1\r\nHost: localhost:${single.port}\r\nConnection: close\r\n\r\n`),
      )
      let buf = ''
      s.on('data', (d) => (buf += d))
      s.on('close', () => resolve(buf))
    })
  })
  assert.match(raw, /^HTTP\/1\.1 404/)
  assert.ok(!raw.includes('root:'))
})

test('rejects foreign Host headers (DNS rebinding)', async () => {
  const res = await new Promise((resolve) => {
    import('node:http').then(({ request }) => {
      request({ host: '127.0.0.1', port: single.port, path: '/', headers: { Host: 'evil.example' } }, (r) => resolve(r.statusCode)).end()
    })
  })
  assert.equal(res, 403)
})

test('folder mode: sidebar lists every markdown file; subpages render', async () => {
  const home = await (await get(folder.url, '/')).text()
  assert.match(home, /id="sidebar"/)
  assert.match(home, /href="\/README\.md"/)
  assert.match(home, /href="\/docs\/a\.md"/)
  const a = await (await get(folder.url, '/docs/a.md')).text()
  assert.match(a, /<h1 id="doc-a">/)
  assert.match(a, /aria-current="page"/)
  const redirect = await get(folder.url, '/docs', { redirect: 'manual' })
  assert.equal(redirect.status, 301)
})

test('live reload: saving the file pushes an SSE reload within a second', async () => {
  const res = await get(single.url, '/__readly/events')
  const reader = res.body.getReader()
  await reader.read() // retry preamble
  const started = Date.now()
  appendFileSync(join(dir, 'README.md'), '\nmore\n')
  let text = ''
  while (!text.includes('event: reload')) {
    const { value, done } = await reader.read()
    if (done) break
    text += new TextDecoder().decode(value)
  }
  assert.ok(text.includes('event: reload'))
  assert.ok(Date.now() - started < 1000, `took ${Date.now() - started}ms`)
  await reader.cancel()
  assert.match(await (await get(single.url, '/')).text(), /more/)
})

test('port auto-increments when busy', async () => {
  const second = await run(['README.md', '-p', '3400'])
  servers.push(second)
  assert.equal(second.port, 3401)
  assert.match(second.out, /Port 3400 is in use/)
})

test('clear errors and non-zero exit', () => {
  const missing = spawnSync(process.execPath, [CLI, 'nope.md'], { cwd: dir, encoding: 'utf8' })
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /cannot find "nope\.md"/)
  const notMd = spawnSync(process.execPath, [CLI, 'pic.svg'], { cwd: dir, encoding: 'utf8' })
  assert.equal(notMd.status, 1)
  assert.match(notMd.stderr, /not a Markdown file/)
  const badPort = spawnSync(process.execPath, [CLI, 'README.md', '-p', '0'], { cwd: dir, encoding: 'utf8' })
  assert.equal(badPort.status, 1)
  assert.match(badPort.stderr, /invalid port/)
})
