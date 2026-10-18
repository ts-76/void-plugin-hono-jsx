# Optional Hono Markdown

The supported baseline is Void 1.1/Node 24 with plain Vite 8.3.4 or aligned Vite Plus 1.3.0. See the [release contract](release-contract.md). Production ISR remains outside the guarantee. The Hono emitter uses the same options, syntax, CSS classes and defaults as the existing official framework plugins for code highlighting/copy, containers and themes; see the [feature comparison and explicit differences](markdown-compatibility.md).

Install the parser/highlighter peers only in projects using Markdown:

```sh
npm install void-plugin-hono-jsx markdown-exit@1.3.0 yaml@2.9.1 markdown-it-container@4.0.0 shiki@4.5.0 @shikijs/transformers@4.5.0
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

The Markdown entry is independent of `@void/md` and uses its published 1.1.11 implementation as a reference for these features. Do not also configure `@void/md/plugin`, which emits another framework. Ordinary Pages projects do not need any Markdown parser/highlighter peers; importing `/plugin`, `/pages`, `/form` or the Markdown context runtime does not load the compiler.

## Page format

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

The optional leading script block comes before YAML frontmatter. Island imports participate in SSR and use the shared load/visible/idle/media scheduler; remaining JavaScript becomes a page-specific client module. Normal script imports are browser imports. Island component paths must be relative TSX/JSX imports. Tag attributes are literal strings or boolean presence attributes; JSX expressions and tag children are not supported. Each instance receives its own props and mount state.

The compiler supports standard Markdown, tables, raw authored HTML, unique heading anchors and the extensions below. Markdown is repository-authored content; raw HTML is preserved, following Void's authoring model. Footnotes, emoji, arbitrary attributes, GitHub alerts, inline TOC, link/image normalization and the public pages-catalog virtual module are outside this feature set.

## Highlighted code and copying

As in `@void/md`, fenced code is highlighted during Vite transformation with Shiki. Language grammars load on demand; unknown languages render as escaped text. Browsers receive highlighted HTML, not Shiki or parser code. Every fenced code block has a copy button; inline code does not add one. Copy excludes removed diff lines and the final empty Shiki line. Clipboard access requires a supported secure context and browser permission. Rejection/unavailable APIs show failure feedback without breaking the page.

The public configuration follows the official plugin:

```ts
voidHonoMarkdown({
  shiki: { themes: { light: 'github-light', dark: 'github-dark' } },
});
```

Those are also the defaults. Bundled Shiki theme names are supported. Each plugin owns its theme configuration; configuring one project does not change another project. Languages are not configured through the official deprecated `shiki.langs` no-op.

````md
```ts {2} :line-numbers {=5}
const before = 1 // [!code --]
const after = 2 // [!code ++]
```
````

The public Shiki transformers support highlight/diff/focus/warning/error annotations. `:line-numbers` adds a gutter and `{=5}` changes its starting line. Use the theme CSS below for the visual treatment.

## Containers and theme CSS

The five official container names, optional Markdown titles and nesting are supported:

```md
::: tip **Advice**
Helpful content.
:::

::: details More information
Collapsed content.
:::
```

`info`, `warning` and `danger` use the same syntax. Details use native `<details>/<summary>` and need no JavaScript.

For an existing app, import content-only CSS in the project's stylesheet or layout:

```css
@import 'void-plugin-hono-jsx/theme-content.css';
```

Wrap rendered Markdown in `<main class="void-md">...</main>`. CSS is scoped to `.void-md`, with the official `--vmd-*` variables. It supports system color preference and `data-theme="light"` / `"dark"` on `<html>`. To opt into the official global reset and baseline styles for a standalone site, import `void-plugin-hono-jsx/theme.css` instead. Neither stylesheet is injected automatically. Omitting CSS is supported for custom styling.

### Upgrading an existing Markdown project

Add `markdown-it-container`, `shiki` and `@shikijs/transformers` using the pinned command above. The old parser peers alone do not supply the extensions. No options need to be renamed: `voidHonoMarkdown()` keeps working with the official defaults. Existing custom CSS can remain, or use `.void-md` and the content theme. Code-block pages now load copy code by default, matching the official plugin; pages without code blocks, islands or authored scripts remain zero-script. Frontmatter, loader data, context and island contracts are unchanged.

## Layouts, frontmatter and loader data

Use TSX/JSX layouts, including existing island/default/named layouts. Void discovers `layout` in frontmatter, including named/exclusive layouts and `layout: false`. Layout files themselves remain TSX/JSX.

```tsx
import { useFrontmatter, useMarkdownHeadings, useMarkdownProps } from 'void-plugin-hono-jsx/markdown';

export default function DocsLayout({ children }) {
  const frontmatter = useFrontmatter<{ title: string }>();
  const headings = useMarkdownHeadings();
  const props = useMarkdownProps<{ message?: string }>();
  return <main><h1>{frontmatter.title}</h1><p>{props.message}</p>{children}</main>;
}
```

A companion `guide.server.ts` loader works through Void's normal page protocol. Frontmatter title/description contribute to Void head metadata; a companion `head` handler can override them. The provider surrounds the complete SSR layout/page chain and is scoped to that render. Hydrated islands receive the same frontmatter/headings and serialized page props through their own provider; there is no mutable global frontmatter state. Generic hook types describe the authored data and do not perform runtime validation. Frontmatter must be a JSON-serializable mapping; duplicate YAML keys, invalid syntax and cyclic values fail compilation.

## Navigation and assets

Markdown routes use document navigation. A full TSX `<Link>` entering a Markdown route leaves the SPA; normal Markdown links return to TSX pages through a new document. Full Pages keep their existing SPA behavior.

Static Markdown pages without fenced code or authored scripts, with a static layout chain, send no executable script or module preload. Code-copy-only and authored-script-only pages load the Markdown entry and current page's script without the island scheduler/framework entry. Interactive pages load the shared island scheduler and required component modules. Other pages' client scripts remain separate dynamic chunks and do not execute. Interactive pages with a development HMR client use full reloads on content/script edits. Copy-only, script-only and zero-script pages do not include that client and require a normal refresh, including when scripts are added or removed.

Void handles auto-prerender and `output: 'static'`. Companion loader data must be suitable for build-time evaluation, as with other static routes. Actions still require a server; deferred islands and deferred static output remain unsupported. The plugin does not add a second router or patch installed framework packages.

## Validation and source reference

`fixtures/markdown/parser-lock.json` locks parser/highlighter dependencies and overlays the two active framework consumer locks. Overlapping entries must match exactly. The current required consumers use Void 1.1.11 with plain Vite 8.3.4 or Vite Plus/core 1.3.0; older matrix results remain historical evidence. The actual tarball check covers dev/preview/static SSR, loader/head, layouts/context/islands, scheduling, scripts/reloads, containers, Shiki/notation, real clipboard success/rejection/unavailability, zero-script pages and scoped light/dark CSS at desktop/mobile widths. Ordinary Pages are checked before optional peers are installed. Theme CSS is packed alongside its exact source and original MIT attribution; JavaScript/declaration maps remain required.

The reference package separates Markdown parsing from framework emitters, but its public API registers only React/Vue/Svelte/Solid. This plugin implements Hono emission locally using public parser APIs and Void's Markdown asset convention. It neither imports hash-named compiler chunks nor pretends to be another framework. See [Void's Markdown guide](https://void.cloud/guide/pages-routing/markdown) and [third-party attribution](../THIRD_PARTY_NOTICES.md).
