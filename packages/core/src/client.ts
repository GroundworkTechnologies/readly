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
