// Copies the stylesheets and KaTeX fonts built by @readly/core next to the browser bundle.
import { cpSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const coreDist = dirname(require.resolve('@readly/core'))
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'public')
mkdirSync(out, { recursive: true })
for (const f of ['styles.css', 'katex.css']) cpSync(join(coreDist, f), join(out, f))
cpSync(join(coreDist, 'fonts'), join(out, 'fonts'), { recursive: true })
cpSync(new URL('../src/browser/app.css', import.meta.url), join(out, 'app.css'))
console.log('cli assets copied')
