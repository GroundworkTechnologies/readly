import { promises as fs } from 'node:fs'
import path from 'node:path'

export const MARKDOWN_EXT = /\.(md|markdown)$/i
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage'])
const INDEX_NAMES = ['readme.md', 'index.md']

export interface MdEntry {
  /** posix path relative to the served root */
  rel: string
}

/** Recursively lists Markdown files, skipping dotdirs, node_modules and build output. */
export async function listMarkdown(root: string): Promise<MdEntry[]> {
  const out: MdEntry[] = []
  async function walk(dir: string, prefix: string) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const rel = prefix ? `${prefix}/${e.name}` : e.name
      if (e.isDirectory()) {
        if (!IGNORED_DIRS.has(e.name)) await walk(path.join(dir, e.name), rel)
      } else if (e.isFile() && MARKDOWN_EXT.test(e.name)) {
        out.push({ rel })
      }
    }
  }
  await walk(root, '')
  return out.sort(compareEntries)
}

/** README first within each folder, then alphabetical; folders after files. */
function compareEntries(a: MdEntry, b: MdEntry): number {
  const pa = a.rel.split('/')
  const pb = b.rel.split('/')
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    if (pa[i] === pb[i]) continue
    const aLast = i === pa.length - 1
    const bLast = i === pb.length - 1
    if (aLast !== bLast) return aLast ? -1 : 1
    const aIdx = INDEX_NAMES.includes(pa[i]!.toLowerCase())
    const bIdx = INDEX_NAMES.includes(pb[i]!.toLowerCase())
    if (aIdx !== bIdx) return aIdx ? -1 : 1
    return pa[i]!.localeCompare(pb[i]!, undefined, { sensitivity: 'base', numeric: true })
  }
  return pa.length - pb.length
}

/** Picks the page shown for a directory: README.md / index.md, else null. */
export async function findIndex(dir: string): Promise<string | null> {
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch {
    return null
  }
  for (const want of INDEX_NAMES) {
    const hit = names.find((n) => n.toLowerCase() === want)
    if (hit) return path.join(dir, hit)
  }
  return null
}

/**
 * Maps a URL path onto a real file strictly inside `root`.
 * Rejects traversal, dotfiles/dotdirs and symlinks that escape the root.
 * `root` must already be a realpath.
 */
export async function resolveInside(root: string, urlPath: string): Promise<string | null> {
  let decoded: string
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null
  const segments = decoded.split('/').filter(Boolean)
  if (segments.some((s) => s.startsWith('.'))) return null
  let real: string
  try {
    real = await fs.realpath(path.join(root, ...segments))
  } catch {
    return null
  }
  if (real !== root && !real.startsWith(root + path.sep)) return null
  return real
}
