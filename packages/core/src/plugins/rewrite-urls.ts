import type { Element, Root } from 'hast'

export interface RewriteOptions {
  /** Base for relative image / media URLs. */
  baseUrl?: string
  /** Base for relative link URLs. Defaults to `baseUrl`. */
  linkBaseUrl?: string
}

const ABSOLUTE = /^([a-z][a-z0-9+.-]*:|\/|#)/i

function resolve(value: string, base: string | undefined): string {
  if (!base || ABSOLUTE.test(value)) return value
  try {
    return new URL(value, base).href
  } catch {
    return value
  }
}

function resolveSrcset(value: string, base: string | undefined): string {
  return value
    .split(',')
    .map((part) => {
      const [url, ...descriptor] = part.trim().split(/\s+/)
      return [resolve(url ?? '', base), ...descriptor].join(' ')
    })
    .join(', ')
}

const MEDIA_TAGS = new Set(['img', 'source', 'video', 'audio'])

function walk(node: Root | Element, opts: RewriteOptions) {
  for (const child of node.children) {
    if (child.type !== 'element') continue
    const props = child.properties
    if (child.tagName === 'a' && typeof props.href === 'string') {
      props.href = resolve(props.href, opts.linkBaseUrl ?? opts.baseUrl)
    } else if (MEDIA_TAGS.has(child.tagName)) {
      if (typeof props.src === 'string') props.src = resolve(props.src, opts.baseUrl)
      if (typeof props.srcSet === 'string')
        props.srcSet = resolveSrcset(props.srcSet, opts.baseUrl)
    }
    walk(child, opts)
  }
}

/** Resolves relative URLs against a base (used when the source isn't served from its own folder). */
export default function rehypeRewriteUrls(opts: RewriteOptions = {}) {
  return (tree: Root) => {
    if (opts.baseUrl || opts.linkBaseUrl) walk(tree, opts)
  }
}
