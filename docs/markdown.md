# Optional Hono Markdown

Current release policy: see the [approved release contract](release-contract.md). Upcoming RC support is Void 1.1/Node 24 with plain Vite 8.3.4 or aligned Vite Plus 1.3.0. Old matrix results below are historical, not supported installation guidance. Production ISR is outside the initial guarantee.

Use a release that exports `/markdown/plugin` and `voidHonoJsx()`; alpha.3 predates these APIs. Install the parser peers only in projects using Markdown:

```sh
npm install void-plugin-hono-jsx@next markdown-exit@1.3.0 yaml@2.9.1
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

The Markdown entry is independent of `@void/md` and uses its published 0.27.0 implementation as a reference. Do not also configure `@void/md/plugin`, which emits another framework. Ordinary Pages projects do not need the parser peers; importing `/plugin`, `/pages`, `/form` or the Markdown context runtime does not load the compiler.

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

The compiler supports standard Markdown, tables, raw authored HTML, escaped fenced code and unique heading anchors. It does not implement the complete `@void/md` extension set: Shiki highlighting, custom containers, footnotes and theme CSS are not included. Apply the application's own CSS. Markdown is repository-authored content; raw HTML is preserved, following Void's authoring model.

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

Static Markdown pages with a static layout chain send no executable script or module preload. Script-only pages load the Markdown entry and current page's script without the island scheduler/framework entry. Interactive pages load the shared island scheduler and required component modules. Other pages' client scripts remain separate dynamic chunks and do not execute. Interactive pages with a development HMR client use full reloads on content/script edits. Script-only and zero-script pages do not include that client and require a normal refresh, including when scripts are added or removed.

Void handles auto-prerender and `output: 'static'`. Companion loader data must be suitable for build-time evaluation, as with other static routes. Actions still require a server; deferred islands and deferred static output remain unsupported. The plugin does not add a second router or patch installed framework packages.

## Validation and source reference

`fixtures/markdown/parser-lock.json` locks parser dependencies and is combined with the existing seven framework consumer locks; overlapping entries must match exactly. Markdown checks run on baseline/patch/latest Vite and scaffold/latest Vite Plus as well as Void 0.26.1/0.27.0 and Void 1.1.11 with Vite Plus 1.3.0. The packed check exercises direct SSR, loader/head, default/named/island layouts, provider isolation, repeated islands, all scheduling policies, script selection, development edits, TSX document roundtrips, production preview and a file-only static server. Existing non-Markdown consumers remain separate and are tested before optional dependencies are installed into the Markdown fixture.

The reference package separates Markdown parsing from framework emitters, but its public API registers only React/Vue/Svelte/Solid. This plugin implements Hono emission locally using public parser APIs and Void's Markdown asset convention. It neither imports hash-named compiler chunks nor pretends to be another framework. See [Void's Markdown guide](https://void.cloud/guide/pages-routing/markdown) and [third-party attribution](../THIRD_PARTY_NOTICES.md).
