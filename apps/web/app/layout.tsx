import type { Metadata, Viewport } from 'next'
import './globals.css'
import '@readly/core/styles.css'
import '@readly/core/katex.css'

export const metadata: Metadata = {
  title: 'Readly: preview Markdown like GitHub',
  description: 'Render Markdown exactly like GitHub does, in your browser, without pushing.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

// Runs before first paint so the page never flashes the wrong theme (dark unless toggled).
const themeScript = `try{var t=localStorage.getItem('readly-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
