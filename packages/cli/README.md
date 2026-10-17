# readly

Render Markdown exactly like GitHub does, locally, without pushing.

```sh
npx @groundwork/readly README.md           # render one file, open the browser
npx @groundwork/readly .                   # render a folder, with a sidebar of every .md file
npx @groundwork/readly README.md -p 4000   # custom port
npx @groundwork/readly README.md --no-open # don't open the browser
```

Or install it, which gives you the `readly` command:

```sh
npm install --global @groundwork/readly
readly README.md
```

It renders GitHub Flavored Markdown (tables, task lists, footnotes), syntax highlighting, Mermaid diagrams, GitHub alerts, heading anchors, and KaTeX math. Raw HTML is sanitized. Saving the file reloads the browser. Dark by default, with a light toggle.

- Listens on `127.0.0.1` only; default port 3000, next free port if busy.
- Relative images and links resolve against the file's folder, which is the only thing served (no path traversal, no dotfiles).
- Needs Node 18 or newer (developed and tested on Node 22).

Part of [Readly](https://www.npmjs.com/package/@groundwork/readly). Unscoped `readly` is a different, unrelated package on npm.
