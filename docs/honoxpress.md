# honoxpress with Markdown

Use `voidHonoJsx()` and `voidHonoMarkdown()` as described in the [Markdown guide](markdown.md). The integration uses published honoxpress 0.4.0. honoxpress is an application dependency, not a dependency of this adapter.

Copy the editable UI templates you need from `honoxpress/templates` into your application. Keep your wrappers and CSS overrides when updating them. Void owns parsing, routes, the document and islands; honoxpress owns its UI, tokens and explicit docs catalog.

## Static mapping

Wrap the copied components with ordinary Hono JSX, or use honoxpress's parser-neutral renderer:

```tsx
// components/Callout.tsx
import { createDocsMarkdownRenderer } from 'honoxpress/markdown';
import type { Child } from 'hono/jsx';
import { Callout } from './docs-content';

const render = createDocsMarkdownRenderer({ components: {
  Callout: { kind: 'static', render: ({ attributes, children }) =>
    <Callout title={String(attributes.title ?? '')}>{children}</Callout> },
} });

export default function MarkdownCallout({ title = '', children }: { title?: string; children?: Child }) {
  return render('Callout', { title }, children);
}
```

Import that wrapper with `{ component: 'static' }` in Markdown. Map Cards/Card, Steps/Step and native Accordion the same way. Use `:::component` containers for nested body content. A TypeTable wrapper can define its property array in TSX and select localized text with `useFrontmatter()`.

Use the body-only `DocsFrame`, not the full-document `DocsLayout`. The adapter collects Hono CSS into `head`; remove Hono's native `<Style />` from pages/layouts. Configure response nonces with `HonoStyles` and the matching CSP header. See the package README's Hono CSS section.

## Interactive mapping

Define CodeGroup samples and other structured data in a TSX wrapper, then import it with `{ island: 'load' }`. One wrapper can own Tabs and copy controls; avoid nesting their islands. It receives the page's Markdown context through the adapter. Passing Markdown children into an island is unsupported.

For a theme switch, use honoxpress's `ThemeScript` initializer and its matching CSS tokens. A static reading page can omit it and follow the system palette through CSS. Markdown uses document navigation, so language links and browser history load each document's initializer and context. This does not add SPA navigation to Markdown.

## Metadata and styles

An application can eagerly import its `.md` modules with `import.meta.glob()` on the server. Pass exported `frontmatter` and `headings` into `createDocsCatalogFromPages()` with explicit `locale`, translation `slug` and site-local `href`. Convert each Markdown heading's `slug` to honoxpress's `id`. The [packed fixture](../fixtures/honoxpress/hx-catalog.ts) demonstrates this without HonoX filename assumptions or a second parser.

| Content | Delivery |
| --- | --- |
| Static Callout, Cards, Steps, TypeTable, native disclosure | HTML/CSS; no component JavaScript or scheduler. |
| CodeGroup/Tabs wrapper | Explicit island and its browser dependencies. |
| Markdown code fence | Build-time Shiki output plus the page-local copy module. |

The adapter's optional `theme-content.css` styles `.void-md` using `--vmd-*`. honoxpress templates use `.prose`, `.hx-*` and `--docs-*`. They are separate themes: choose their scopes explicitly, or map tokens in application CSS. The fixture uses honoxpress for the docs frame and `.void-md` around highlighted fences. No automatic token conversion or honoxpress-specific parser is installed.

A style-element nonce does not authorize Shiki's inline `style` attributes. The fixture enforces nonces with `style-src-elem` and explicitly permits those attributes with `style-src-attr 'unsafe-inline'`. This is a fixture policy, not a recommended CSP for every app. An app that forbids inline style attributes must adapt the highlighter output and its CSS policy.

The integration adds no parser/highlighter to an ordinary TSX consumer. The browser and deployed Worker execute rendered components, not the Markdown/Shiki compiler. Full MDX expressions and `.mdx` discovery remain outside this integration.
