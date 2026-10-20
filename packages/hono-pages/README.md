# void-plugin-hono-jsx

A community Hono JSX adapter for [Void](https://void.cloud), licensed under [MIT](LICENSE).
It supports SSR pages, navigation, forms, islands, static output and optional Markdown.

## Install

Use Node.js 24.21.0 or newer within Node 24.

```sh
npm install void-plugin-hono-jsx hono@4.13.13
npm install --save-dev void@1.1.11 vite@8.3.4 typescript@7.0.2
```

The default install uses `latest`. Use `@next` to test a release candidate, or an explicit version for reproducible installs.

## Configure

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoJsx } from 'void-plugin-hono-jsx/plugin';

export default defineConfig({
  plugins: [voidPlugin(), voidHonoJsx()],
});
```

Set `jsx: "react-jsx"` and `jsxImportSource: "hono/jsx"` in TypeScript.
The adapter includes JSX transformation. Run Vite from the project root and keep Void settings in `void.config.ts`.

## Supported versions

| Dependency | Supported stable range | Tested version |
| --- | --- | --- |
| Node.js | >=24.21.0 <25.0.0 | 24.21.0 |
| Void | >=1.1.11 <1.2.0 | 1.1.11 |
| Hono | >=4.13.13 <5.0.0 | 4.13.13 |
| Vite | >=8.0.16 <9.0.0 | 8.3.4 |

TypeScript 7.0.2 and Vite Plus/core 1.3.0 are tested. Prerelease framework versions and Void 0.x are unsupported.
Accepted ranges do not imply that every future release has been tested.

## Running Vite and launcher diagnostics

For Vite Plus 1.3.0, keep the launcher and core aligned:

```json
{
  "devDependencies": {
    "vite": "npm:@voidzero-dev/vite-plus-core@1.3.0",
    "vite-plus": "1.3.0"
  },
  "overrides": { "vite": "$vite" }
}
```

Use `defineConfig` from `vite-plus` and keep `vp dev`, `vp build` and `vp preview`.
This configuration runs host Vite 8.3.4.

Compatibility errors report the running Vite, imported helper version and resolved package paths.
If installed versions look correct, check the launcher and stale peer resolutions in your lockfile.
Installing a direct `vite` dependency does not change a launcher's bundled Vite.

## Adapting a Void scaffold

For a React scaffold:

1. Replace `@void/react/plugin` and `voidReact()` with this adapter and `voidHonoJsx()`. Keep `voidPlugin()`.
2. Set the TypeScript JSX options above. Replace React imports and hooks with Hono equivalents.
3. Remove unused React, React DOM, their types, `@void/react` and `oxc-transform-react` dependencies.
4. Check launcher alignment, then test the app's loaders, actions and migrations.

## Runtime exports

```tsx
import {
  Link, useRouter, useShared, useParams, useErrors, useNavigation,
  deferredResult, type Deferred, type DeferredResult,
} from 'void-plugin-hono-jsx/pages';
import { Form, useForm, useIslandForm, action } from 'void-plugin-hono-jsx/form';
```

See the [Pages guide](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/pages.md) for navigation options, form methods, pending UI and error handling.

### Multipart forms

Use `<Form form={form} encType="multipart/form-data">` or pass `FormData` to a form submission method.
Files, repeated fields and the clicked submitter are preserved.
Full Pages performs one GET after a successful mutation, so the destination must support GET and loaders may rerun.
Read the [multipart transport guide](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/pages.md#multipart-forms).

## Deferred loader props

Return Void's `defer()` from a loader, then read `Deferred<T>` or use `deferredResult()` with Hono Suspense.
Deferred data is supported in full Pages. Deferred islands and static deferred output are unsupported.
See [deferred data](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/pages.md#deferred-loader-props).

## Islands

Use `.island.tsx` pages and attributed imports such as `with { island: 'visible' }`.
Supported policies are `load`, `visible`, `idle` and `media:(query)`.
Static-only pages send no client script. Use `useIslandForm` for island forms.
Follow the [island examples and restrictions](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/pages.md#islands).

## Static output and prerendering

Set `output: 'static'` in `void.config.ts` and build with Vite.
Serve the generated HTML, assets and `/_void/pages` JSON from `dist/client`.
Actions require a server. Check the generated files: failed prerender paths may be omitted with a warning.
See [static output](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/pages.md#static-output-and-prerendering).

## Optional Markdown

Install these peers only when using Markdown:

```sh
npm install markdown-exit@1.3.0 yaml@2.9.1 markdown-it-container@4.0.0 shiki@4.5.0 @shikijs/transformers@4.5.0
```

Add `voidHonoMarkdown()` from `void-plugin-hono-jsx/markdown/plugin` after `voidHonoJsx()`.
It supports frontmatter, layouts, loaders, islands, Shiki highlighting, copy buttons and five container types.
Import `void-plugin-hono-jsx/theme-content.css` and wrap Markdown in `.void-md` for scoped styles.

Markdown uses document navigation and preserves authored HTML. Use trusted content; no HTML sanitization is provided.
See the [Markdown guide](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/markdown.md) for static components, explicit islands and migration from 0.1.x, or the [honoxpress example](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/honoxpress.md).

## Hono CSS

The adapter collects default `hono/css` rules into one `style#hono-css` in head, before application stylesheets. Pages and islands reuse this host; static pages need no client JavaScript for their CSS. Do not render Hono's `<Style />` inside a page or layout.

For a per-response CSP nonce, render `<HonoStyles nonce={nonce} />` from `void-plugin-hono-jsx/pages` in the SSR tree. It configures the head host and adds no element inside the client root. Use one nonce per document; SPA navigation retains the initial host and nonce. Pass the same nonce in the response's CSP header. CSP nonce setup for client-only shells is not provided.

This integration covers the default CSS context. Custom `createCssContext()` hosts need their own lifecycle. Hono may register initial SSR rules again on first client render; subsequent visits reuse its registry. Exact SSR-to-client rule deduplication is not guaranteed.

## Source and debugging files

The package includes TypeScript source under `src`, JavaScript source maps and declaration maps.
Use the documented package exports for application imports.

## Compatibility and rendering limits

- Browser mounting redraws SSR content; DOM reuse and pre-mount input/focus preservation are not guaranteed.
- Development edits reload the document and reset local state.
- Failed deferred prefetch can resolve to `null`.
- A local Void/Miniflare connection-reuse issue remains unresolved after some rejected POSTs.
- Direct Workers ISR has a [dated verification](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/isr-cloudflare-verification.md) with an unresolved query-purge limitation. The managed Void platform remains unverified.

See [known limitations](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/known-limitations.md) for conditions and follow-up work.

## Security

The reviewed Void dependency tree retains an upstream esbuild advisory.
The adapter adds no transitive overrides. Publisher tooling is assessed separately.
See the [security policy](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/SECURITY.md) and report vulnerabilities [privately](https://github.com/ts-76/void-plugin-hono-jsx/security/advisories/new).

## Shared Hono Markdown and host boundaries

`packages/hono-markdown` contains the independent `@ts-76/hono-markdown` package:
compiler, literal component parsing, metadata context/hooks, CSS and DOM island
scheduling. It has no Void or Vite dependency. Accepted release checks install the published common dependency; local
development checks may select a candidate tarball alongside the adapter.

The Void plugin owns page discovery, layouts, head, loaders, virtual modules and
Void's scheduler. Existing `/markdown`, `/markdown/compiler`, `/markdown/client`
and theme imports remain supported. The old and common imports share the same
Markdown context, avoiding duplicate providers when documents and decks coexist.
The legacy client entry retains the existing slide-activation fallback for older
hono-decks releases; new hosts supply their own `ready` gate.

Maintainer `npm install`, `npm run typecheck`, and `npm test` automatically build
the common package. `npm run build:package` builds both packages.
`npm run check:consumer` first verifies the independent package, then installs
both candidates and runs the existing real-app checks. Run
`node scripts/check-independent-markdown-consumer.mjs` to verify Markdown SSR in
a fresh consumer without Void or Vite installed. Local development checks can supply `HONO_MARKDOWN_PACKAGE`.
Accepted release artifacts always install the published common dependency;
local dependency substitutions are rejected for release evidence.

Release the common package before an adapter version that depends on it. The
existing adapter release gate still checks the exact artifact and permits only
the documented common dependency; it does not publish the new package implicitly.

The legacy theme exports retain their existing CSS snapshot and source files.
They do not automatically copy changes from the common theme. This preserves
existing styling while the new common theme can evolve independently.
