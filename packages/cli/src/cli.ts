import { parseArgs } from 'node:util'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import pkg from '../package.json' with { type: 'json' }
import { MARKDOWN_EXT, listMarkdown } from './files.js'
import { openBrowser } from './open.js'
import { startServer } from './server.js'

const HELP = `readly ${pkg.version}
Render Markdown exactly like GitHub does, locally, without pushing.

Usage
  readly <file.md>       render one file and open it in the browser
  readly <folder>        render a folder, with a sidebar of all .md files
  readly .               same, for the current folder

Options
  -p, --port <number>    port to listen on (default 3000, next free port if busy)
      --no-open          don't open the browser
  -h, --help             show this help
  -v, --version          show the version
`

function fail(message: string): never {
  console.error(`readly: ${message}`)
  process.exit(1)
}

async function main() {
  let parsed
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        port: { type: 'string', short: 'p' },
        'no-open': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    })
  } catch (err) {
    fail(`${err instanceof Error ? err.message : err}\n\n${HELP}`)
  }
  const { values, positionals } = parsed

  if (values.help) return void console.log(HELP)
  if (values.version) return void console.log(pkg.version)
  if (positionals.length === 0) {
    console.error(HELP)
    process.exit(1)
  }
  if (positionals.length > 1) fail('expected a single file or folder')

  let port = 3000
  if (values.port !== undefined) {
    port = Number(values.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      fail(`invalid port "${values.port}" (expected 1-65535)`)
    }
  }

  const target = path.resolve(positionals[0]!)
  let stat
  try {
    stat = await fs.stat(target)
  } catch {
    fail(`cannot find "${positionals[0]}": no such file or folder`)
  }

  let root: string
  let entry: string | undefined
  if (stat.isDirectory()) {
    root = target
    if ((await listMarkdown(root)).length === 0) {
      fail(`no Markdown files found in "${positionals[0]}"`)
    }
  } else if (stat.isFile()) {
    if (!MARKDOWN_EXT.test(target)) fail(`"${positionals[0]}" is not a Markdown file (.md or .markdown)`)
    root = path.dirname(target)
    entry = target
  } else {
    fail(`"${positionals[0]}" is neither a file nor a folder`)
  }

  let server
  try {
    server = await startServer({ root, entry, port })
  } catch (err) {
    fail(`could not start the server: ${err instanceof Error ? err.message : err}`)
  }

  if (server.port !== port) console.log(`Port ${port} is in use, using ${server.port} instead.`)
  const shown = entry ?? root
  const relative = path.relative(process.cwd(), shown)
  console.log(`Serving ${relative && !relative.startsWith('..') ? relative : shown}`)
  console.log(`  ${server.url}`)
  console.log('Press Ctrl+C to stop.')

  if (!values['no-open']) openBrowser(server.url)

  const shutdown = () => {
    server.close().finally(() => process.exit(0))
    setTimeout(() => process.exit(0), 1000).unref()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)))
