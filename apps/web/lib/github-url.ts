export interface Source {
  /** Raw file URL to fetch. */
  rawUrl: string
  /** Base for relative images (the raw folder). */
  baseUrl: string
  /** Base for relative links (the GitHub blob folder when we can tell). */
  linkBaseUrl: string
}

const dirOf = (url: string) => url.slice(0, url.lastIndexOf('/') + 1)

/**
 * Accepts raw.githubusercontent.com / gist.githubusercontent.com URLs, and also
 * github.com/<owner>/<repo>/blob|raw/<ref>/<path>, which it turns into the raw URL.
 */
export function parseGitHubUrl(input: string): Source | { error: string } {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return { error: 'That does not look like a URL.' }
  }
  if (url.protocol !== 'https:') return { error: 'Only https URLs are supported.' }

  const parts = url.pathname.split('/').filter(Boolean)

  if (url.hostname === 'raw.githubusercontent.com') {
    const [owner, repo, ref, ...path] = parts
    if (!owner || !repo || !ref || path.length === 0) return { error: 'Expected a raw URL to a file.' }
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path.join('/')}`
    const dir = path.slice(0, -1).join('/')
    return {
      rawUrl,
      baseUrl: dirOf(rawUrl),
      linkBaseUrl: `https://github.com/${owner}/${repo}/blob/${ref}/${dir ? dir + '/' : ''}`,
    }
  }

  if (url.hostname === 'gist.githubusercontent.com') {
    return { rawUrl: url.href, baseUrl: dirOf(url.href), linkBaseUrl: dirOf(url.href) }
  }

  if (url.hostname === 'github.com') {
    const [owner, repo, kind, ref, ...path] = parts
    if ((kind === 'blob' || kind === 'raw') && owner && repo && ref && path.length > 0) {
      return parseGitHubUrl(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path.join('/')}`)
    }
    return { error: 'Paste a link to a file: github.com/<owner>/<repo>/blob/<branch>/<path>.' }
  }

  return { error: 'Only GitHub URLs (github.com or raw.githubusercontent.com) are supported.' }
}
