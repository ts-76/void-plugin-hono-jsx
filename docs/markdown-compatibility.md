# Markdown compatibility and adopted features

Issue #99 reference: published `@void/md@1.1.11`, inspected on 2026-10-18, and the [official Markdown guide](https://void.cloud/guide/pages-routing/markdown). Its [public plugin API](https://github.com/voidzero-dev/void/blob/e868ec4c65776aa087e6ce8f4679a3ed1528a3f9/packages/md/src/plugin.ts) registers React/Vue/Svelte/Solid. The published export map exposes the plugin, contexts, pages metadata and CSS, but does not expose a compiler or Hono emitter hook. This adapter uses public parser/highlighter APIs rather than importing a private or hash-named compiler.

The maintainer requested alignment with the existing framework plugins. Settings, syntax, CSS classes and defaults therefore follow `@void/md` for the four selected features. The adapter keeps its Hono emitter and stricter frontmatter validation. This is feature-level alignment, not a claim of complete official compiler compatibility.

| Area | Official 1.1.11 | Hono decision |
| --- | --- | --- |
| Fenced code | Shiki 4.5, light/dark themes, languages loaded on demand, unknown language falls back to text | Adopt; build/server transform only. Same `shiki.themes.light` / `dark` options, default github-light/github-dark. No independent highlight toggle. |
| Code notation | Highlight, diff, focus, warning/error annotations, line numbers | Adopt the public Shiki transformers and line-number syntax. Copy excludes removed diff lines and the final empty Shiki line. |
| Code copy | Enabled for fenced code; adds client code only when needed | Adopt default behavior and `.language-* > button.copy` / `.copied` markup. Use the existing page-specific module pipeline rather than an inline script; no Hono/scheduler needed for a copy-only document. Rejected/unavailable clipboard gets feedback, not an unhandled error. |
| Containers | tip / info / warning / danger / details, optional Markdown titles, nested content | Adopt all five using the public markdown-it-container API. Same `.custom-block`, title classes and native details/summary. |
| Themes | theme.css reset + content; theme-content.css scoped to `.void-md`, `--vmd-*` variables, auto/explicit dark mode | Adopt both entry names and upstream CSS with MIT notice. Content-only CSS is recommended for existing apps. Add keyboard/touch visibility for copy buttons. Never inject reset/global CSS automatically. |
| Metadata/layout/islands | YAML, headings, loader data, document navigation, framework-specific emission | Keep existing Hono contract and request-scoped provider. Duplicate YAML keys, cycles and non-mapping metadata still fail. Keep static TSX/JSX layouts and literal island props. |
| Hono component bodies | Framework-specific component emission | Explicit `{ component: 'static' }` local imports and `:::component` containers render nested Markdown through Hono JSX. Structured data stays in TSX wrappers; explicit islands retain literal props and no Markdown children. |
| Ordinary Pages dependencies | Markdown is a separate package | Keep all Markdown parser/highlighter peers optional; normal Pages do not install them. Existing Markdown projects add the new peers when upgrading to these features. |
| Footnotes, emoji, arbitrary attrs, GitHub alerts, link/image normalization, inline TOC | Additional official parser plugins | Defer: beyond the four requested feature groups. Preserve existing link/image behavior rather than silently changing navigation. |
| Pages catalog | `@void/md/pages` virtual metadata array | Defer: internal graph snapshot is not a public page-catalog API. |
| Additional framework emitters / Markdown layouts | Official framework-specific behavior | Defer: Hono uses TSX/JSX layouts; do not register another adapter or imitate React internals. |
| Deprecated `shiki.langs` option | No effect; languages load on demand | Do not introduce a deprecated no-op in the new Hono options. |

## Implementation and acceptance

One parser per plugin creates complete scan snapshots. Transforms reuse the parsed snapshot when its source matches; each plugin owns its highlighter/themes, and concurrent language loads share promises. No global first-plugin configuration or repeated graph getter reads are introduced. Static island/layout CSS uses the same public import-extraction/rewrite utilities as the official React adapter: production retains CSS in the client asset manifest, while development keeps Void's first-paint collector. This emits stylesheet links even for zero-script documents without injecting a theme automatically.

Validation covers containers/titles/nesting, build-time highlighting and themes, unknown languages, escaped code, actual clipboard success/rejection/unavailability, page-only copy code, static pages without fences/scripts, existing layouts/frontmatter/islands, CSS scoping/light/dark behavior and real tarball dev/preview/static consumers on both supported stacks. The package gate accepts only the six known theme filenames, checks emitted CSS against its packaged source and keeps JS/declaration map checks intact.

Raw repository-authored HTML remains trusted input. These features add no sanitization guarantee. Future support claims require their own fixture, browser and dependency audit evidence.

## Upstream extension opportunity

These features shipped in 0.2.0. A public compiler/parser configuration API and framework emitter hook would allow closer sharing with the official plugins. Until then, use public parser APIs and keep the differences in this table explicit.
