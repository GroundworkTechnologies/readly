'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { renderMarkdown } from '@readly/core'
import { getTheme, hydrate, onThemeChange, themeIcons, toggleTheme, type Theme } from '@readly/core/client'
import { parseGitHubUrl } from '../lib/github-url'
import { SAMPLE } from '../lib/sample'

interface Bases {
  baseUrl?: string
  linkBaseUrl?: string
}

const MARKDOWN_FILE = /\.(md|markdown|txt)$/i
const btn =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-subtle text-sm text-fg hover:brightness-125 disabled:opacity-50 [&_svg]:fill-current'

export function Readly() {
  const [markdown, setMarkdown] = useState(SAMPLE)
  const [html, setHtml] = useState('')
  const [bases, setBases] = useState<Bases>({})
  const [view, setView] = useState<'edit' | 'preview'>('edit') // narrow screens only
  const [theme, setThemeState] = useState<Theme>('dark')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragging, setDragging] = useState(false)
  const preview = useRef<HTMLElement>(null)

  // theme: the inline script already applied it; mirror it for the toggle icon
  useEffect(() => {
    setThemeState(getTheme())
    return onThemeChange(setThemeState)
  }, [])

  // render (debounced, latest wins)
  useEffect(() => {
    let stale = false
    const timer = setTimeout(async () => {
      try {
        const out = await renderMarkdown(markdown, bases)
        if (stale) return
        setHtml(out)
        if (preview.current) {
          preview.current.innerHTML = out
          await hydrate(preview.current)
        }
      } catch (err) {
        if (!stale) setStatus({ kind: 'error', text: `Render failed: ${err instanceof Error ? err.message : err}` })
      }
    }, 120)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [markdown, bases])

  const loadFile = useCallback(async (file: File) => {
    if (!MARKDOWN_FILE.test(file.name)) {
      setStatus({ kind: 'error', text: `"${file.name}" is not a Markdown file (.md, .markdown, .txt).` })
      return
    }
    setMarkdown(await file.text())
    setBases({})
    setStatus({ kind: 'info', text: `Loaded ${file.name}` })
    setView('preview')
  }, [])

  // drag and drop anywhere on the page
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setDragging(true)
    }
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault()
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      if (--depth <= 0) setDragging(false)
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const file = e.dataTransfer?.files[0]
      if (file) void loadFile(file)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [loadFile])

  async function fetchUrl(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseGitHubUrl(url)
    if ('error' in parsed) return setStatus({ kind: 'error', text: parsed.error })
    setStatus({ kind: 'info', text: 'Fetching…' })
    try {
      const res = await fetch(parsed.rawUrl)
      if (!res.ok) throw new Error(res.status === 404 ? 'File not found (is the repo private?)' : `HTTP ${res.status}`)
      setMarkdown(await res.text())
      setBases({ baseUrl: parsed.baseUrl, linkBaseUrl: parsed.linkBaseUrl })
      setStatus({ kind: 'info', text: 'Fetched. Relative images and links resolve against the repo.' })
      setView('preview')
    } catch (err) {
      setStatus({ kind: 'error', text: `Could not fetch: ${err instanceof Error ? err.message : err}` })
    }
  }

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(html)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setStatus({ kind: 'error', text: 'Clipboard is not available in this browser context.' })
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-col gap-2 border-b border-line px-4 py-2 md:flex-row md:items-center md:gap-4">
        <h1 className="text-sm text-muted md:shrink-0">
          <span className="font-semibold text-fg">Readly</span> renders Markdown exactly like GitHub does, without pushing.
        </h1>
        <form onSubmit={fetchUrl} className="flex min-w-0 flex-1 gap-2 md:justify-end">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a raw GitHub URL…"
            aria-label="Raw GitHub URL"
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none md:max-w-md"
          />
          <button type="submit" className={`${btn} px-3`} disabled={!url.trim()}>
            Fetch
          </button>
        </form>
        <div className="flex gap-2">
          <button type="button" className={`${btn} px-3`} onClick={copyHtml} disabled={!html}>
            {copied ? 'Copied' : 'Copy HTML'}
          </button>
          <button
            type="button"
            className={`${btn} w-8 justify-center`}
            onClick={() => toggleTheme()}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            dangerouslySetInnerHTML={{ __html: theme === 'dark' ? themeIcons.sun : themeIcons.moon }}
          />
        </div>
      </header>

      {status && (
        <p
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={`border-b border-line px-4 py-1.5 text-xs ${status.kind === 'error' ? 'text-danger' : 'text-muted'}`}
        >
          {status.text}
        </p>
      )}

      <div className="flex border-b border-line md:hidden" role="tablist">
        {(['edit', 'preview'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 text-sm capitalize ${view === v ? 'border-b-2 border-accent font-semibold text-fg' : 'text-muted'}`}
          >
            {v}
          </button>
        ))}
      </div>

      <main className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          spellCheck={false}
          aria-label="Markdown source"
          className={`h-full w-full resize-none border-0 bg-canvas p-4 font-mono text-[13px] leading-relaxed text-fg focus:outline-none md:border-r md:border-line ${view === 'edit' ? '' : 'hidden md:block'}`}
        />
        <div className={`min-h-0 overflow-auto ${view === 'preview' ? '' : 'hidden md:block'}`}>
          <article ref={preview} className="markdown-body !mx-auto !max-w-[860px] !p-6 md:!p-8" />
        </div>
      </main>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-sm">
          <div className="rounded-lg border-2 border-dashed border-accent px-10 py-8 text-lg text-fg">
            Drop a Markdown file to render it
          </div>
        </div>
      )}
    </div>
  )
}
