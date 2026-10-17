import type { NextConfig } from 'next'

// Rendering happens in the browser with @readly/core, so the app is fully static.
const config: NextConfig = {
  output: 'export',
  reactStrictMode: true,
}

export default config
