import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { renderMarkdown } from '../dist/index.js'

const sample = readFileSync(new URL('./fixtures/sample.md', import.meta.url), 'utf8')
const html = await renderMarkdown(sample)
const has = (needle) => assert.ok(html.includes(needle), `expected output to contain: ${needle}`)
const lacks = (needle) => assert.ok(!html.includes(needle), `expected output NOT to contain: ${needle}`)

test('GFM: tables with alignment', () => {
  has('<table>')
  has('<th align="center">Supported</th>')
  has('<th align="right">Notes</th>')
})

test('GFM: task lists', () => {
  has('class="contains-task-list"')
  has('<input type="checkbox" checked disabled>')
  has('<input type="checkbox" disabled> Ship it')
})

test('GFM: strikethrough, autolinks', () => {
  has('<del>Strikethrough</del>')
  has('<a href="https://github.com/features">https://github.com/features</a>')
})

test('GFM: footnotes link up (refs, ids and back-refs agree)', () => {
  has('href="#user-content-fn-1"')
  has('id="user-content-fn-1"')
  has('href="#user-content-fnref-1"')
  has('id="user-content-fnref-1"')
  has('data-footnotes')
  // the visually hidden footnotes heading gets no anchor
  assert.match(html, /<h2 class="sr-only" id="user-content-footnote-label">Footnotes<\/h2>/)
})

test('syntax highlighting for labelled blocks', () => {
  has('class="hljs language-ts"')
  has('<span class="hljs-keyword">interface</span>')
  has('class="hljs language-bash"')
})

test('mermaid blocks are left untouched for client-side rendering', () => {
  assert.match(html, /<code class="language-mermaid">graph TD/)
  lacks('hljs language-mermaid')
})

test('alerts: all five types', () => {
  for (const [kind, title] of [
    ['note', 'Note'],
    ['tip', 'Tip'],
    ['important', 'Important'],
    ['warning', 'Warning'],
    ['caution', 'Caution'],
  ]) {
    assert.match(html, new RegExp(`<div class="markdown-alert markdown-alert-${kind}" dir="auto"><p class="markdown-alert-title" dir="auto"><svg class="octicon octicon-[a-z-]+ mr-2".*?</svg>${title}</p>`))
  }
  lacks('[!NOTE]')
  has('Useful information that users should know')
})

test('plain blockquotes are not turned into alerts', () => {
  has('<blockquote>')
  has('A normal blockquote')
})

test('heading anchors: ids, link icon, duplicates', () => {
  assert.match(html, /<h2 id="tables"><a class="anchor" aria-hidden="true" href="#tables"><svg class="octicon octicon-link"/)
  has('id="duplicate-heading"')
  has('id="duplicate-heading-1"')
})

test('math: inline and display via KaTeX', () => {
  assert.equal((html.match(/class="katex"/g) ?? []).length >= 3, true)
  has('class="katex-display"')
  has('encoding="application/x-tex">E = mc^2<')
})

test('invalid math does not throw', async () => {
  const out = await renderMarkdown('$\\badcommand{$')
  assert.ok(out.includes('katex'))
})

test('sanitize: dangerous HTML is removed', () => {
  lacks('<script')
  lacks('alert(')
  lacks('onerror')
  lacks('javascript:')
  lacks('<iframe')
})

test('sanitize: GitHub-safe HTML is kept', () => {
  has('<details>')
  has('<summary>Click to expand</summary>')
  has('<strong>markdown</strong> content inside')
  has('<picture>')
  has('<source media="(prefers-color-scheme: dark)" srcset="images/logo.svg">')
  has('<img alt="Picture fallback" src="images/logo.svg" width="48">')
  has('<p align="center">')
  has('<kbd>Ctrl</kbd>')
  has('<sub>2</sub>')
  has('<br>')
})

test('relative URLs are left alone by default (CLI serves the folder)', () => {
  has('<img src="images/logo.svg" alt="Relative image">')
  has('href="docs/other.md"')
})

test('baseUrl resolves relative images and links; absolute/hash links untouched', async () => {
  const out = await renderMarkdown(
    '![a](img/a.png) [b](../b.md) [c](#top) [d](https://x.dev/y) <picture><source srcset="p.png 1x, p2.png 2x"></picture>',
    {
      baseUrl: 'https://raw.githubusercontent.com/o/r/main/docs/',
      linkBaseUrl: 'https://github.com/o/r/blob/main/docs/',
    },
  )
  assert.ok(out.includes('src="https://raw.githubusercontent.com/o/r/main/docs/img/a.png"'))
  assert.ok(out.includes('href="https://github.com/o/r/blob/main/b.md"'))
  assert.ok(out.includes('href="#top"'))
  assert.ok(out.includes('href="https://x.dev/y"'))
  assert.ok(out.includes('srcset="https://raw.githubusercontent.com/o/r/main/docs/p.png 1x, https://raw.githubusercontent.com/o/r/main/docs/p2.png 2x"'))
})

test('#foo links reach user-authored anchors (clobber prefix)', async () => {
  const out = await renderMarkdown('<a name="spot"></a>\n\n[go](#spot)')
  assert.ok(out.includes('name="user-content-spot"'))
  assert.ok(out.includes('href="#user-content-spot"'))
})

test('css build outputs exist', () => {
  for (const f of ['styles.css', 'katex.css', 'fonts/KaTeX_Main-Regular.woff2']) {
    assert.ok(existsSync(new URL(`../dist/${f}`, import.meta.url)), f)
  }
  const css = readFileSync(new URL('../dist/styles.css', import.meta.url), 'utf8')
  assert.ok(css.includes(':root:not([data-theme="light"])'), 'dark is the default')
  assert.ok(css.includes(':root[data-theme="light"]'))
  assert.ok(!css.includes('prefers-color-scheme'), 'theme is attribute driven')
})
