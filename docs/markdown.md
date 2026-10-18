# Markdown

Add Markdown pages to an app configured with `voidHonoJsx()`.
Install the parser/highlighter peers only when using Markdown:

```sh
npm install markdown-exit@1.3.0 yaml@2.9.1 markdown-it-container@4.0.0 shiki@4.5.0 @shikijs/transformers@4.5.0
```

```ts
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoJsx } from 'void-plugin-hono-jsx/plugin';
import { voidHonoMarkdown } from 'void-plugin-hono-jsx/markdown/plugin';

export default defineConfig({
  plugins: [voidPlugin(), voidHonoJsx(), voidHonoMarkdown()],
});
```

Do not also configure `@void/md/plugin`. This plugin emits Hono components independently.

## Page format

Create `.md` files in the Pages directory:

```md
<script>
import Counter from "../components/Counter.tsx" with { island: "visible" };
document.querySelector('#updated').textContent = 'Ready';
</script>
---
title: Getting started
description: Hono Markdown example
layout: docs
---
# Getting started

<div id="updated">SSR content</div>

<Counter name="example" initial="4" />
```

The optional script block comes before frontmatter.
Island imports use relative TSX/JSX paths and the load/visible/idle/media policies.
Other script code runs in the browser for this page only.
Island props are literal strings or boolean attributes. Put arrays, objects and JSX logic in a TSX wrapper; island tag children are unsupported.

Standard Markdown, tables, heading anchors and authored HTML are supported.
**Use trusted content:** raw HTML is preserved without sanitization.
Footnotes, emoji, arbitrary attributes, GitHub alerts, inline TOC and link/image normalization are outside this syntax subset.

## Static components

Use an explicit default import to render a local TSX/JSX component on the server:

````md
<script>
import Callout from "../components/Callout.tsx" with { component: "static" };
import Properties from "../components/Properties.tsx" with { component: "static" };
</script>
# Guide

:::component Callout title="Before you start"
Write **Markdown** inside the component.
:::

<Properties />
````

`:::component Name` passes parsed Markdown as `children`. For nesting, give the outer container more colons than its children:

```md
::::component Cards
:::component Card title="Guide"
## A heading inside a card

Card content.
:::
::::
```

Headings, reference links and code fences use the same page parser, including inside containers. Component titles and headings created inside TSX are not added to Markdown's TOC automatically.

Static imports are removed from the page's browser script. Static components and their CSS render during SSR/SSG; their display alone adds no client runtime. Descendant components may opt into islands using the existing attributed imports. Keep interactive hooks in those islands.

Attributes are literal strings or booleans. JSX expressions, spread syntax and duplicate attributes fail compilation. Static component attributes also reject `on*` names and renderer-owned props such as `children`, `ref` and `dangerouslySetInnerHTML`; use a TSX wrapper to map them. Existing island literal keys retain their data semantics. Use a TSX wrapper for structured props. Imported component paths must be relative TSX/JSX files; package components can be re-exported through a local wrapper.

For an existing paired HTML component tag, its body is already rendered HTML. Use the container syntax when its children need Markdown parsing. Raw `<script>`, `<style>`, `<pre>`, `<textarea>` and HTML comments are not component invocation syntax.

See [honoxpress integration](honoxpress.md) for a component mapping, metadata/catalog connection and static versus interactive delivery.

## Highlighted code and copying

Fenced code is highlighted at build time with Shiki. Unknown languages render as escaped text.
Each fenced block gets a copy button; browsers do not load Shiki or the parser.
Copy omits removed diff lines. It needs a secure context and clipboard permission; failures show feedback.

Customize the default themes:

```ts
voidHonoMarkdown({
  shiki: { themes: { light: 'github-light', dark: 'github-dark' } },
});
```

Bundled Shiki themes are supported. Languages load on demand; there is no `shiki.langs` setting.
Use highlight/diff/focus/warning/error annotations and line numbers:

````md
```ts {2} :line-numbers {=5}
const before = 1 // [!code --]
const after = 2 // [!code ++]
```
````

`:line-numbers` adds a gutter; `{=5}` sets its starting number.

## Containers and theme CSS

Use `tip`, `info`, `warning`, `danger` or `details`, with optional Markdown titles and nested content:

```md
::: tip **Advice**
Helpful content.
:::

::: details More information
Collapsed content.
:::
```

Details use native HTML and need no JavaScript.
For scoped styles, import this CSS in your stylesheet or layout:

```css
@import 'void-plugin-hono-jsx/theme-content.css';
```

Wrap Markdown in `<main class="void-md">...</main>`.
Customize `--vmd-*` variables, or set `data-theme="light"` / `"dark"` on `<html>`.
Without an explicit theme, styles follow the system preference.

For a standalone site, `theme.css` also includes the global reset and baseline styles.
Neither stylesheet is injected automatically; custom styling is supported.

### Upgrading an existing Markdown project

From 0.1.x, add `markdown-it-container`, `shiki` and `@shikijs/transformers` using the command above.
`voidHonoMarkdown()` keeps its name and accepts the defaults.
Code blocks now add copy controls and a page-local script by default.
Existing frontmatter, loader, layout and island contracts are unchanged.

## Layouts, frontmatter and loader data

Use TSX/JSX layouts. Frontmatter supports default/named/exclusive layouts and `layout: false`.

```tsx
import type { Child } from 'hono/jsx';
import { useFrontmatter, useMarkdownHeadings, useMarkdownProps } from 'void-plugin-hono-jsx/markdown';

export default function DocsLayout({ children }: { children: Child }) {
  const frontmatter = useFrontmatter<{ title: string }>();
  const headings = useMarkdownHeadings();
  const props = useMarkdownProps<{ message?: string }>();
  return <main><h1>{frontmatter.title}</h1><p>{props.message}</p>{children}</main>;
}
```

A companion `guide.server.ts` can provide a loader and head handler.
Frontmatter title/description contribute to head metadata; a head handler can override them.
Layouts and islands receive the page's frontmatter, headings and serialized loader props.
Hook type parameters describe data; they do not validate it.
Frontmatter must be a JSON-serializable mapping. Duplicate keys, invalid YAML and cycles fail compilation.

## Navigation and assets

Markdown uses document navigation, including links to and from full Pages.
Void handles prerendering and static output. Static loaders must work at build time; actions require a server.
Deferred islands and static deferred output are unsupported.

| Page content | Client code |
| --- | --- |
| Static layout, no fences/islands/scripts | No executable script or module preload. |
| Copy controls or authored scripts only | Page-local module, without the island scheduler/framework entry. |
| Interactive islands | Shared scheduler and required component modules. |

Interactive pages with a development client use full reloads on edits.
Copy-only, script-only and zero-script pages need manual refresh, including when adding or removing scripts.

See the [official feature comparison](markdown-compatibility.md) for design differences and [testing guide](testing.md) for validation coverage.
