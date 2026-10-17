import type { MdEntry } from './files.js'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const encodePath = (rel: string) => rel.split('/').map(encodeURIComponent).join('/')

/** Folder-mode sidebar: every Markdown file, grouped under its directory. */
export function renderSidebar(entries: MdEntry[], currentRel: string | null, rootName: string): string {
  const seen = new Set<string>()
  const items: string[] = []
  for (const { rel } of entries) {
    const parts = rel.split('/')
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts.slice(0, i + 1).join('/')
      if (seen.has(dir)) continue
      seen.add(dir)
      items.push(`<li class="nav-dir" style="--depth:${i}">${escapeHtml(parts[i]!)}</li>`)
    }
    const active = rel === currentRel
    items.push(
      `<li style="--depth:${parts.length - 1}"><a class="nav-file${active ? ' active' : ''}" href="/${encodePath(rel)}"${active ? ' aria-current="page"' : ''}>${escapeHtml(parts[parts.length - 1]!)}</a></li>`,
    )
  }
  return `<div class="nav-title">${escapeHtml(rootName)}</div><ul>${items.join('')}</ul>`
}

export interface PageInput {
  title: string
  contentHtml: string
  /** Present in folder mode only. */
  sidebarHtml?: string
}

export function renderPage({ title, contentHtml, sidebarHtml }: PageInput): string {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · readly</title>
<script>try{var t=localStorage.getItem('readly-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){}</script>
<link rel="stylesheet" href="/__readly/styles.css">
<link rel="stylesheet" href="/__readly/katex.css">
<link rel="stylesheet" href="/__readly/app.css">
</head>
<body${sidebarHtml ? ' class="has-sidebar"' : ''}>
<button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle theme" title="Toggle theme"></button>
${sidebarHtml ? `<nav id="sidebar" class="sidebar" aria-label="Markdown files">${sidebarHtml}</nav>` : ''}
<main class="page">
<article id="content" class="markdown-body">${contentHtml}</article>
</main>
<script type="module" src="/__readly/app.js"></script>
</body>
</html>`
}

export function renderMessagePage(title: string, message: string, status: string): string {
  return renderPage({
    title,
    contentHtml: `<h1>${escapeHtml(status)}</h1><p>${escapeHtml(message)}</p>`,
  })
}
