import { defineConfig } from 'tsup'

export default defineConfig([
  // The CLI itself. express + chokidar stay external (real dependencies);
  // @readly/core and the whole unified toolchain are bundled in.
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node18',
    banner: { js: '#!/usr/bin/env node' },
    noExternal: [/^@readly\//],
  },
  // The browser bundle served at /__readly/app.js (mermaid is split into lazy chunks).
  {
    entry: { app: 'src/browser/app.ts' },
    outDir: 'dist/public',
    format: ['esm'],
    platform: 'browser',
    target: 'es2022',
    splitting: true,
    minify: true,
    noExternal: [/.*/],
  },
])
