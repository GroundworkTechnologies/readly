import express from 'express'
import chokidar from 'chokidar'
import { promises as fs } from 'node:fs'
import type { Server } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderMarkdown } from '@readly/core'
import { MARKDOWN_EXT, findIndex, listMarkdown, resolveInside, type MdEntry } from './files.js'
import { renderMessagePage, renderPage, renderSidebar } from './page.js'

export interface ServerOptions {
  /** Directory that is served. Must exist. */
  root: string
  /** Single-file mode: the Markdown file shown at `/`. Omit for folder mode. */
  entry?: string
  port: number
}

export interface RunningServer {
  url: string
  port: number
  close(): Promise<void>
}

const publicDir = fileURLToPath(new URL('./public', import.meta.url))
const MAX_PORT_TRIES = 100

function listen(app: express.Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1')
    server.once('listening', () => resolve(server))
    server.once('error', reject)
  })
}

/** Tries `port`, then port+1, ... until one is free. */
async function listenFrom(app: express.Express, port: number): Promise<{ server: Server; port: number }> {
  for (let p = port; p < port + MAX_PORT_TRIES && p <= 65535; p++) {
    try {
      return { server: await listen(app, p), port: p }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw err
    }
  }
  throw new Error(`no free port found in ${port}-${port + MAX_PORT_TRIES - 1}`)
}

export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const root = await fs.realpath(opts.root)
  const entry = opts.entry ? await fs.realpath(opts.entry) : undefined
  const folderMode = !entry

  let mdCache: MdEntry[] | null = null
  const markdownFiles = async () => (mdCache ??= await listMarkdown(root))

  const app = express()
  app.disable('x-powered-by')

  // Only answer requests addressed to our own loopback origin (blocks DNS rebinding).
  const allowedHosts = new Set<string>()
  app.use((req, res, next) => {
    if (!req.headers.host || !allowedHosts.has(req.headers.host.toLowerCase())) {
      res.status(403).type('text/plain').send('Forbidden')
      return
    }
    next()
  })

  // ---- live reload (Server-Sent Events)
  const clients = new Set<express.Response>()
  app.get('/__readly/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })
    res.write('retry: 500\n\n')
    clients.add(res)
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000)
    req.on('close', () => {
      clearInterval(heartbeat)
      clients.delete(res)
    })
  })
  const broadcast = () => {
    for (const res of clients) res.write('event: reload\ndata: {}\n\n')
  }

  // ---- browser bundle + stylesheets
  app.use('/__readly', express.static(publicDir, { index: false, maxAge: 0 }))

  // ---- pages and files
  async function sendMarkdown(res: express.Response, file: string) {
    const source = await fs.readFile(file, 'utf8')
    const contentHtml = await renderMarkdown(source)
    const rel = path.relative(root, file).split(path.sep).join('/')
    const sidebarHtml = folderMode
      ? renderSidebar(await markdownFiles(), rel, path.basename(root))
      : undefined
    res
      .set('Cache-Control', 'no-store')
      .type('html')
      .send(renderPage({ title: path.basename(file), contentHtml, sidebarHtml }))
  }

  const notFound = (res: express.Response, what: string) =>
    res.status(404).type('html').send(renderMessagePage('Not found', `Nothing at ${what}`, '404'))

  app.use(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).type('text/plain').send('Method Not Allowed')
      return
    }

    if (entry && req.path === '/') return sendMarkdown(res, entry)

    const file = await resolveInside(root, req.path)
    if (!file) return notFound(res, req.path)

    const stat = await fs.stat(file)
    if (stat.isDirectory()) {
      if (!req.path.endsWith('/')) {
        // keep relative links inside the directory resolving correctly
        const query = req.url.slice(req.path.length)
        return res.redirect(301, `${req.path}/${query}`)
      }
      const index = await findIndex(file)
      if (index) return sendMarkdown(res, index)
      return notFound(res, req.path)
    }

    if (MARKDOWN_EXT.test(file)) return sendMarkdown(res, file)

    res.sendFile(file, {
      dotfiles: 'deny',
      headers: { 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' },
    })
  })

  // express 5 forwards async errors here
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err)
    res
      .status(500)
      .type('html')
      .send(renderMessagePage('Error', err instanceof Error ? err.message : String(err), '500'))
  })

  // ---- file watching
  let timer: NodeJS.Timeout | undefined
  const changed = (event: string) => {
    if (event === 'add' || event === 'unlink' || event === 'addDir' || event === 'unlinkDir') mdCache = null
    clearTimeout(timer)
    timer = setTimeout(broadcast, 50)
  }
  const watcher = chokidar.watch(entry ?? root, {
    ignoreInitial: true,
    ignored: (p) => /(^|[\\/])(\.git|node_modules)([\\/]|$)/.test(p),
  })
  watcher.on('all', changed)
  // chokidar errors (e.g. too many watchers) must not crash the server
  watcher.on('error', (err) => console.error(`watcher: ${err instanceof Error ? err.message : err}`))

  const { server, port } = await listenFrom(app, opts.port)
  allowedHosts.add(`127.0.0.1:${port}`).add(`localhost:${port}`)

  return {
    url: `http://localhost:${port}`,
    port,
    async close() {
      clearTimeout(timer)
      await watcher.close()
      for (const res of clients) res.end()
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      })
    },
  }
}
