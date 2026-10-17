/** Browser-only helpers: theme handling and client-side Mermaid rendering. */

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'readly-theme'
const THEME_EVENT = 'readly:theme'
const DEFAULT_THEME: Theme = 'dark'

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // storage blocked: fall through to the default
  }
  return DEFAULT_THEME
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }))
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

/** Applies the saved theme (dark unless the user toggled). Call as early as possible. */
export function initTheme(): Theme {
  const theme = getTheme()
  document.documentElement.dataset.theme = theme
  return theme
}

export function onThemeChange(cb: (theme: Theme) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<Theme>).detail)
  window.addEventListener(THEME_EVENT, handler)
  return () => window.removeEventListener(THEME_EVENT, handler)
}

// ---------------------------------------------------------------- mermaid

type MermaidApi = typeof import('mermaid').default

let mermaidPromise: Promise<MermaidApi> | undefined
let renderQueue: Promise<unknown> = Promise.resolve()
let counter = 0

function loadMermaid(): Promise<MermaidApi> {
  return (mermaidPromise ??= import('mermaid').then((m) => m.default))
}

async function drawDiagram(el: HTMLElement): Promise<void> {
  const source = el.dataset.source ?? ''
  const mermaid = await loadMermaid()
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: getTheme() === 'dark' ? 'dark' : 'default',
  })
  try {
    const { svg } = await mermaid.render(`readly-mermaid-${counter++}`, source)
    el.innerHTML = svg
    el.classList.remove('readly-mermaid-error')
  } catch (err) {
    // mermaid leaves a stray error node in <body>; remove it.
    document.querySelectorAll('[id^="dreadly-mermaid"]').forEach((n) => n.remove())
    el.classList.add('readly-mermaid-error')
    el.textContent = `Mermaid error: ${err instanceof Error ? err.message : String(err)}`
  }
}

function queue(task: () => Promise<void>): Promise<void> {
  const run = renderQueue.then(task, task)
  renderQueue = run.catch(() => undefined)
  return run
}

function replaceMermaidBlocks(root: ParentNode): HTMLElement[] {
  const found: HTMLElement[] = []
  root.querySelectorAll<HTMLElement>('pre > code.language-mermaid').forEach((code) => {
    const pre = code.parentElement!
    const host = document.createElement('div')
    host.className = 'readly-mermaid'
    host.dataset.source = code.textContent ?? ''
    pre.replaceWith(host)
    found.push(host)
  })
  return found
}

let themeListening = false

// ---------------------------------------------------------------- anchors

/** GitHub prefixes user-authored ids with `user-content-`; make `#foo` find either form. */
function resolveHash(): void {
  const id = decodeURIComponent(location.hash.slice(1))
  if (!id) return
  const target =
    document.getElementById(id) ?? document.getElementById(`user-content-${id}`)
  target?.scrollIntoView()
}

let hashListening = false

/**
 * Call after injecting rendered HTML into the page. Renders Mermaid diagrams
 * and keeps them in sync with the active theme.
 */
export async function hydrate(root: ParentNode = document): Promise<void> {
  if (!themeListening) {
    themeListening = true
    onThemeChange(() => {
      document
        .querySelectorAll<HTMLElement>('.readly-mermaid')
        .forEach((el) => void queue(() => drawDiagram(el)))
    })
  }
  if (!hashListening) {
    hashListening = true
    window.addEventListener('hashchange', resolveHash)
  }
  const diagrams = replaceMermaidBlocks(root)
  await Promise.all(diagrams.map((el) => queue(() => drawDiagram(el))))
  resolveHash()
}

// ---------------------------------------------------------------- toggle icons

const svg = (d: string) =>
  `<svg class="octicon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${d}"></path></svg>`

/** Octicon sun / moon, for theme toggle buttons. Show `sun` while dark, `moon` while light. */
export const themeIcons = {
  sun: svg(
    'M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm5.657-8.157a.75.75 0 0 1 0 1.061l-1.061 1.06a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l1.06-1.06a.75.75 0 0 1 1.06 0Zm-9.193 9.193a.75.75 0 0 1 0 1.06l-1.06 1.061a.75.75 0 1 1-1.061-1.06l1.06-1.061a.75.75 0 0 1 1.061 0ZM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0ZM3 8a.75.75 0 0 1-.75.75H.75a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 3 8Zm13 0a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 16 8Zm-8 5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13Zm3.536-1.464a.75.75 0 0 1 1.06 0l1.061 1.06a.75.75 0 0 1-1.06 1.061l-1.061-1.06a.75.75 0 0 1 0-1.061ZM2.343 2.343a.75.75 0 0 1 1.061 0l1.06 1.061a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-1.06-1.06a.75.75 0 0 1 0-1.06Z',
  ),
  moon: svg(
    'M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786Zm1.616 1.945a7 7 0 0 1-7.678 7.678 5.499 5.499 0 1 0 7.678-7.678Z',
  ),
}
