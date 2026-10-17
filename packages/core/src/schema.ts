import { defaultSchema, type Options as Schema } from 'rehype-sanitize'

// rehype-sanitize's default schema is modelled on GitHub's own sanitizer.
// We extend it for the few GitHub-safe pieces it leaves out.
export const schema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'picture', 'source'],
  attributes: {
    ...defaultSchema.attributes,
    // remark-math marks math with these classes; rehype-katex needs them.
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ['className', /^language-./, 'math-inline', 'math-display'],
    ],
    source: ['srcSet', 'media', 'type', 'sizes'],
    img: [...(defaultSchema.attributes?.img ?? []), 'loading'],
  },
}
