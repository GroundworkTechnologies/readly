import { hydrate, initTheme, getTheme, onThemeChange, themeIcons, toggleTheme } from '@readly/core/client'

initTheme()

// ---- theme toggle (dark by default; the button offers the other theme)
const button = document.getElementById('theme-toggle')!
function paintToggle() {
  const dark = getTheme() === 'dark'
  button.innerHTML = dark ? themeIcons.sun : themeIcons.moon
  button.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme')
}
button.addEventListener('click', () => toggleTheme())
onThemeChange(paintToggle)
paintToggle()

void hydrate()

// ---- live reload: swap in the freshly rendered page without losing scroll position
async function refresh() {
  try {
    const res = await fetch(location.href, { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    const next = new DOMParser().parseFromString(await res.text(), 'text/html')
    const content = document.getElementById('content')
    const nextContent = next.getElementById('content')
    if (!content || !nextContent) throw new Error('no content')
    const y = window.scrollY
    content.innerHTML = nextContent.innerHTML
    const sidebar = document.getElementById('sidebar')
    const nextSidebar = next.getElementById('sidebar')
    if (sidebar && nextSidebar) sidebar.innerHTML = nextSidebar.innerHTML
    document.title = next.title
    await hydrate(content)
    window.scrollTo(0, y)
  } catch {
    location.reload()
  }
}

let connected = false
const events = new EventSource('/__readly/events')
events.addEventListener('reload', () => void refresh())
events.addEventListener('open', () => {
  // server restarted while the page was open: pick up whatever changed
  if (connected) void refresh()
  connected = true
})
