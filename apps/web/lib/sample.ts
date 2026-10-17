export const SAMPLE = `# Readly

Paste Markdown here, drop a \`.md\` file anywhere, or fetch a raw GitHub URL above.

> [!TIP]
> This preview uses the same renderer as the \`readly\` CLI, so what you see is what GitHub shows.

## Features

| Feature | Status |
| ------- | :----: |
| Tables | ✅ |
| Task lists | ✅ |
| Mermaid | ✅ |

- [x] GitHub Flavored Markdown
- [x] Syntax highlighting
- [ ] Your README

\`\`\`ts
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

\`\`\`mermaid
graph LR
  A[Markdown] --> B(Readly) --> C[GitHub-style HTML]
\`\`\`

Math works too: $E = mc^2$

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$
`
