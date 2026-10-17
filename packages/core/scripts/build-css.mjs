// Builds dist/styles.css, dist/katex.css and dist/fonts/* for @readly/core.
//
// github-markdown-css ships GitHub's real light + dark palettes, but only behind
// `@media (prefers-color-scheme)`. We unwrap them so the theme is driven by
// `<html data-theme>` instead: dark by default, light when toggled.
import { createRequire } from 'node:module'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
mkdirSync(dist, { recursive: true })

// ---- GitHub markdown css, theme-attribute driven
let css = readFileSync(require.resolve('github-markdown-css/github-markdown.css'), 'utf8')

const SCOPES = {
  dark: ':root:not([data-theme="light"]), :root:not([data-theme="light"]) .markdown-body',
  light: ':root[data-theme="light"], :root[data-theme="light"] .markdown-body',
}
for (const theme of ['dark', 'light']) {
  const re = new RegExp(
    `@media \\(prefers-color-scheme: ${theme}\\) \\{\\s*\\.markdown-body, \\[data-theme="${theme}"\\] \\{([\\s\\S]*?)\\n  \\}\\n\\}`,
  )
  if (!re.test(css)) throw new Error(`could not find the ${theme} block in github-markdown.css`)
  css = css.replace(re, (_, body) => `${SCOPES[theme]} {${body}\n}`)
}

// ---- readly additions (alerts, syntax colours, mermaid)
// The alert colours in github-markdown-css are hard-coded for dark; make them follow the theme.
const extras = `
/* readly: alerts follow the theme */
.markdown-body .markdown-alert { border-left-color: var(--borderColor-default); }
.markdown-body .markdown-alert .markdown-alert-title svg { margin-right: 8px; fill: currentColor; }
.markdown-body .markdown-alert.markdown-alert-note { border-left-color: var(--borderColor-accent-emphasis); }
.markdown-body .markdown-alert.markdown-alert-note .markdown-alert-title { color: var(--fgColor-accent); }
.markdown-body .markdown-alert.markdown-alert-tip { border-left-color: var(--borderColor-success-emphasis); }
.markdown-body .markdown-alert.markdown-alert-tip .markdown-alert-title { color: var(--fgColor-success); }
.markdown-body .markdown-alert.markdown-alert-important { border-left-color: var(--borderColor-done-emphasis); }
.markdown-body .markdown-alert.markdown-alert-important .markdown-alert-title { color: var(--fgColor-done); }
.markdown-body .markdown-alert.markdown-alert-warning { border-left-color: var(--borderColor-attention-emphasis); }
.markdown-body .markdown-alert.markdown-alert-warning .markdown-alert-title { color: var(--fgColor-attention); }
.markdown-body .markdown-alert.markdown-alert-caution { border-left-color: var(--borderColor-danger-emphasis); }
.markdown-body .markdown-alert.markdown-alert-caution .markdown-alert-title { color: var(--fgColor-danger); }

/* readly: highlight.js classes -> GitHub's prettylights palette */
.markdown-body pre code.hljs { display: block; background: transparent; padding: 0; }
.markdown-body .hljs-comment, .markdown-body .hljs-quote { color: var(--color-prettylights-syntax-comment); }
.markdown-body .hljs-keyword, .markdown-body .hljs-selector-tag, .markdown-body .hljs-doctag,
.markdown-body .hljs-template-tag, .markdown-body .hljs-template-variable { color: var(--color-prettylights-syntax-keyword); }
.markdown-body .hljs-string, .markdown-body .hljs-meta .hljs-string, .markdown-body .hljs-regexp,
.markdown-body .hljs-addition { color: var(--color-prettylights-syntax-string); }
.markdown-body .hljs-number, .markdown-body .hljs-literal, .markdown-body .hljs-attr,
.markdown-body .hljs-attribute, .markdown-body .hljs-selector-id, .markdown-body .hljs-selector-class,
.markdown-body .hljs-selector-attr, .markdown-body .hljs-selector-pseudo, .markdown-body .hljs-symbol,
.markdown-body .hljs-bullet { color: var(--color-prettylights-syntax-constant); }
.markdown-body .hljs-title, .markdown-body .hljs-title.class_, .markdown-body .hljs-title.function_,
.markdown-body .hljs-section { color: var(--color-prettylights-syntax-entity); }
.markdown-body .hljs-name, .markdown-body .hljs-tag { color: var(--color-prettylights-syntax-entity-tag); }
.markdown-body .hljs-built_in, .markdown-body .hljs-variable, .markdown-body .hljs-params,
.markdown-body .hljs-type { color: var(--color-prettylights-syntax-variable); }
.markdown-body .hljs-meta { color: var(--color-prettylights-syntax-constant); }
.markdown-body .hljs-deletion { color: var(--color-prettylights-syntax-markup-deleted-text); background-color: var(--color-prettylights-syntax-markup-deleted-bg); }
.markdown-body .hljs-addition { background-color: var(--color-prettylights-syntax-markup-inserted-bg); color: var(--color-prettylights-syntax-markup-inserted-text); }
.markdown-body .hljs-emphasis { font-style: italic; }
.markdown-body .hljs-strong { font-weight: 600; }

/* readly: task lists and visually-hidden text */
.markdown-body .task-list-item { list-style-type: none; }
.markdown-body .task-list-item input[type="checkbox"] { margin: 0 .2em .25em -1.4em; vertical-align: middle; }
.markdown-body .contains-task-list .contains-task-list { margin-top: 4px; }
.markdown-body .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

/* readly: code blocks and diagrams */
.markdown-body pre { padding: 16px; overflow: auto; font-size: 85%; line-height: 1.45; background-color: var(--bgColor-muted); border-radius: 6px; margin-bottom: 16px; }
.markdown-body pre code { font-size: 100%; }
.markdown-body .readly-mermaid { display: flex; justify-content: center; margin-bottom: 16px; overflow: auto; }
.markdown-body .readly-mermaid-error { color: var(--fgColor-danger); white-space: pre-wrap; font-family: var(--fontStack-monospace); font-size: 12px; }
.markdown-body .katex-display { overflow-x: auto; overflow-y: hidden; }
`

writeFileSync(join(dist, 'styles.css'), css + extras)

// ---- KaTeX css + fonts, resolved relative to rehype-katex so we use the exact copy it renders with
const rehypeKatexPath = require.resolve('rehype-katex')
const katexRequire = createRequire(rehypeKatexPath)
const katexDist = dirname(katexRequire.resolve('katex/dist/katex.min.css'))
cpSync(join(katexDist, 'katex.min.css'), join(dist, 'katex.css'))
cpSync(join(katexDist, 'fonts'), join(dist, 'fonts'), { recursive: true })
// katex.css references fonts/KaTeX_*.woff2 relative to itself, matching dist/fonts.
console.log('core css built')
