import type { Element, ElementContent, Root, Text } from 'hast'
import { octicon, type OcticonName } from '../icons.js'

const ALERTS: Record<string, { title: string; icon: OcticonName }> = {
  note: { title: 'Note', icon: 'info' },
  tip: { title: 'Tip', icon: 'light-bulb' },
  important: { title: 'Important', icon: 'report' },
  warning: { title: 'Warning', icon: 'alert' },
  caution: { title: 'Caution', icon: 'stop' },
}

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n|$)/i

const isElement = (n: unknown): n is Element =>
  !!n && (n as Element).type === 'element'

/** Turns `> [!NOTE]` blockquotes into GitHub's `markdown-alert` markup. */
function convert(node: Element): Element | undefined {
  const first = node.children.find(
    (c) => !(c.type === 'text' && c.value.trim() === ''),
  )
  if (!isElement(first) || first.tagName !== 'p') return
  const lead = first.children[0]
  if (!lead || lead.type !== 'text') return
  const match = MARKER.exec(lead.value)
  if (!match) return
  const kind = match[1]!.toLowerCase()
  const alert = ALERTS[kind]!

  lead.value = lead.value.slice(match[0].length)
  if (lead.value === '') first.children.shift()
  // "[!NOTE]  \ntext" leaves a hard break behind.
  const head = first.children[0]
  if (isElement(head) && head.tagName === 'br') {
    first.children.shift()
    const next: ElementContent | undefined = first.children[0]
    if (next?.type === 'text') next.value = next.value.replace(/^\r?\n/, '')
  }

  const body: ElementContent[] = node.children.filter((c) => {
    if (isElement(c) && c === first) return first.children.length > 0
    return !(c.type === 'text' && c.value.trim() === '')
  })

  const title: Element = {
    type: 'element',
    tagName: 'p',
    properties: { className: ['markdown-alert-title'], dir: 'auto' },
    children: [octicon(alert.icon, 'mr-2'), { type: 'text', value: alert.title } as Text],
  }

  return {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['markdown-alert', `markdown-alert-${kind}`],
      dir: 'auto',
    },
    children: [title, ...body],
  }
}

function walk(node: Root | Element) {
  node.children.forEach((child, i) => {
    if (!isElement(child)) return
    if (child.tagName === 'blockquote') {
      const alert = convert(child)
      if (alert) {
        node.children[i] = alert
        walk(alert)
        return
      }
    }
    walk(child)
  })
}

export default function rehypeAlerts() {
  return (tree: Root) => walk(tree)
}
