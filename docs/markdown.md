# Markdown integration boundary

Markdown rendering remains unsupported. This record distinguishes a usable adapter integration from an extension check and is the implementation plan for issue #56.

## Verified public package

The isolated probe installed `@void/md@0.27.0` from the npm registry with scripts disabled and imported its public `@void/md/plugin` entry. Calling `voidMarkdown()[0].configResolved()` with the Hono adapter failed:

```text
void-md: No framework adapter detected. Install @void/vue, @void/react, @void/svelte, or @void/solid.
```

The published plugin identifies adapters through a closed name table (`void-vue:pages`, `void-react:pages`, `void-svelte:pages`, `void-solid:pages`). Its transform dispatch emits those four frameworks. `MarkdownOptions` exposes Shiki configuration only; the plugin API exposes client-script collection and entry metadata, not compiler registration. The public export map includes `.`, `./plugin`, `./pages` and theme CSS, but no compile/script-extraction entry. The placeholder frontmatter runtime returns an empty object until a supported framework replaces it.

Reproduce in an isolated npm project containing exactly `@void/md@0.27.0`:

```js
import assert from 'node:assert/strict';
import { voidMarkdown } from '@void/md/plugin';
assert.throws(() => voidMarkdown()[0].configResolved({
  root: process.cwd(),
  plugins: [{ name: 'void-hono:pages' }],
}), /No framework adapter detected/);
```

Adding a fake React plugin name would emit React components and runtime imports. Importing hash-named private compiler chunks, rewriting the installed plugin or maintaining a copied Markdown compiler would not establish a supported integration. None is used here. Installing `@void/md` in ordinary Hono consumers is not required.

## Upstream change needed

One supported public integration path is needed before implementation can proceed:

1. Add Hono directly to the compiler's adapter dispatch and expose a Hono frontmatter runtime; or
2. Add a documented adapter registration option that receives compiled HTML/frontmatter/headings, extracted island imports and client scripts, and lets the Hono adapter emit its module. Publish the compiler/extractor entry if adapters must invoke them separately.

The public API should keep stable module exports (`default`, `frontmatter`, `headings`, layout metadata) and give the renderer enough information to register only the active page's script and islands. Plugin-name detection alone is insufficient; component emission and frontmatter context must also be implemented.

## Adapter work after that gate

- Reuse Void route discovery, companion server loaders, head descriptors and prerender path handling; accept `.md` only when the supported compiler is configured.
- Pass frontmatter to a Hono context provider per rendered request/page. Do not keep it in mutable process-global state; concurrent SSR requests and layout renders must remain isolated.
- Start with document navigation for Markdown routes. Keep full TSX Pages navigation supported and verify TSX→Markdown→TSX visits. Do not include server-only Markdown modules in the SPA client manifest.
- Register compiler-discovered islands with the existing Hono scheduling/graph machinery; independently mount repeated components with their own serialized props.
- Emit only the page-specific script and required island assets. Static Markdown pages without scripts or interactive layout chains must send no executable framework entry.

## Required acceptance evidence

A pinned optional consumer must verify direct SSR, companion loader, frontmatter in default/named layouts, head updates, page-specific script execution, load/visible/idle/media islands, native navigation in both directions, dev edits, build/preview and static output. Also verify no Markdown dependency or asset is added to a non-Markdown consumer. Until those tests pass, issue #56 stays open; current diagnostics explicitly identify the upstream gate.

Sources: [npm package](https://www.npmjs.com/package/@void/md/v/0.27.0), [official Markdown guide](https://void.cloud/guide/pages-routing/markdown), and the downloaded public `0.27.0` distribution (`dist/plugin.mjs`, `dist/plugin-DcZ5SZxg.d.mts`, `dist/runtime/index.mjs`, package export map).
