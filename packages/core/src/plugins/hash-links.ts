import type { Element, Root } from 'hast'

const PREFIX = 'user-content-'

/**
 * rehype-sanitize prefixes ids with `user-content-` (anti DOM-clobbering, same as
 * GitHub). GitHub then fixes `#foo` links with JS; we rewrite them up front so
 * footnotes and `<a name>` anchors work without JavaScript.
 */
export default function rehypeHashLinks() {
  return (tree: Root) => {
    const ids = new Set<string>()
    const links: Element[] = []

    const walk = (node: Root | Element) => {
      for (const child of node.children) {
        if (child.type !== 'element') continue
        if (typeof child.properties.id === 'string') ids.add(child.properties.id)
        if (child.tagName === 'a' && typeof child.properties.name === 'string')
          ids.add(child.properties.name)
        if (child.tagName === 'a' && typeof child.properties.href === 'string') {
          if (child.properties.href.startsWith('#')) links.push(child)
        }
        walk(child)
      }
    }
    walk(tree)

    for (const link of links) {
      const raw = link.properties.href as string
      let target = raw.slice(1)
      try {
        target = decodeURIComponent(target)
      } catch {
        // keep as-is
      }
      if (target && !ids.has(target) && ids.has(PREFIX + target)) {
        link.properties.href = `#${PREFIX}${target}`
      }
    }
  }
}
