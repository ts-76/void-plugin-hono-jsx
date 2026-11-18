# void-plugin-hono-jsx

A community Hono JSX adapter for [Void](https://void.cloud), licensed under [MIT](LICENSE).
It supports SSR pages, navigation, forms, islands, static output and optional Markdown.

## Install

Use Node.js 24.22.1 or newer within Node 24.

```sh
npm install void-plugin-hono-jsx hono@4.13.16
npm install --save-dev void@1.10.0 vite@8.3.5 typescript@7.0.2
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
| Node.js | >=24.22.1 <25.0.0 | 24.22.1 |
| Void | >=1.6.2 <1.11.0 | 1.10.0 |
| Hono | >=4.13.16 <5.0.0 | 4.13.16 |
| Vite | >=8.0.16 <9.0.0 | 8.3.5 |

TypeScript 7.0.2 and Vite Plus/core 1.4.0 are tested. Prerelease framework versions and Void 0.x are unsupported.
Accepted ranges do not imply that every future release has been tested.
Versions outside these ranges print a warning at startup and are not blocked; they may not work.

## Running Vite and launcher diagnostics

For Vite Plus 1.4.0, keep the launcher and core aligned:

```json
{
  "devDependencies": {
    "vite": "npm:@voidzero-dev/vite-plus-core@1.4.0",
    "vite-plus": "1.4.0"
  },
  "overrides": { "vite": "$vite" }
}
```

Use `defineConfig` from `vite-plus` and keep `vp dev`, `vp build` and `vp preview`.
This configuration runs host Vite 8.3.4.

Version warnings name the running Vite, which the launcher decides, and the supported range.
If installed versions look correct, check the launcher and stale peer resolutions in your lockfile.
Installing a direct `vite` dependency does not change a launcher's bundled Vite.

## Adapting a Void scaffold

For a React scaffold:

1. Replace `@void/react/plugin` and `voidReact()` with this adapter and `voidHonoJsx()`. Keep `voidPlugin()`.
2. Set the TypeScript JSX options above. Replace React imports and hooks with Hono equivalents.
3. Remove unused React, React DOM, their types, `@void/react` and `oxc-transform-react` dependencies.
4. Check launcher alignment, then test the app's loaders, actions and migrations.

## Runtime exports

Migrate `void-plugin-hono-jsx/pages` and `void-plugin-hono-jsx/form` imports to
`void-plugin-hono-jsx`. Vite setup continues to use `void-plugin-hono-jsx/plugin`.
Applications compiling Markdown directly should install `@ts-76/hono-markdown`
and use its `/compiler` entry. Set `contextModule: 'void-plugin-hono-jsx/markdown'`
when generated modules should resolve the context through the Void adapter.

```tsx
import {
  Link, useRouter, useShared, useParams, useErrors, useNavigation,
  deferredResult, type Deferred, type DeferredResult,
  Form, useForm, useIslandForm, action,
  isVoidActionError, isCallSiteActionError, type VoidActionError, type InferProps,
} from 'void-plugin-hono-jsx';
```

`isVoidActionError`, `isCallSiteActionError`, `VoidActionError` and `InferProps` are re-exported from Void, as in the official adapters.

Runnable navigation, forms and error handling are in the [Pages example](https://github.com/ts-76/void-plugin-hono-jsx/tree/main/examples/pages).

`Link` marks the current page with `aria-current="page"` and `data-void-active`.
Use `activeMatch="prefix"` to also style parent links. Links to the destination
being loaded receive `data-void-pending`.
Set `prefetch.defaultStrategy` in `voidHonoJsx()` for a default on GET links.
An individual link can override the default or opt out with `prefetch={false}`.
`preserveState` keeps the page mounted only when the page component and route
parameters are the same. Query changes can keep state. A different record resets
page state while the surrounding layout keeps its usual lifetime.

For `useForm()`, `reset()` restores the last submitted values after a
successful JSON action. Use `reset({ initial: true })` to restore the original
values, or `resetOnSuccess: true` to restore them after each successful save.
Editing a field dismisses its own validation message and preserves other messages.
`setError(field, message)` adds a client-side message for one field; editing that field dismisses it in the same way.

### Multipart forms

Create both Pages and Island forms with the action URL, for example
`useForm('/forms?save', { name: '' })` or `useIslandForm('/forms?save', { name: '' })`.
With the URL bound, use `<Form form={form}>` or call `form.post()`. Replace
legacy `useForm(defaults)` and `<Form url>` with this form. Use a separate form
or `action()` for a different action.

Use `<Form form={form} encType="multipart/form-data">` or call
`form.post({ data: formData })` to submit multipart data.
Files, repeated fields and the clicked submitter are preserved.
Full Pages performs one GET after a successful mutation, so the destination must support GET and loaders may rerun.
Cancellation cannot undo writes.

## Deferred loader props

Return Void's `defer()` from a loader, then read `Deferred<T>` or use `deferredResult()` with Hono Suspense.
Deferred data is supported in full Pages. Deferred islands and static deferred output are unsupported.
Failed prefetch may resolve to `null`.

## Islands

Use `.island.tsx` pages and attributed imports such as `with { island: 'visible' }`.
Supported policies are `load`, `visible`, `idle` and `media:(query)`.
Static-only pages send no client script. Use `useIslandForm` for island forms.
In development, editing an island component file renders its mounted islands again without reloading the page; their state resets.
Edits that change the island graph, such as island imports, stylesheets or files the component imports, still reload the page.
Use the [Pages island example](https://github.com/ts-76/void-plugin-hono-jsx/tree/main/examples/pages) for scheduling and component boundaries.

## Static output and prerendering

Set `output: 'static'` in `void.config.ts` and build with Vite.
Serve the generated HTML, assets and `/_void/pages` JSON from `dist/client`.
Actions require a server. Check the generated files: failed prerender paths may be omitted with a warning.
See the runnable [static fixture](https://github.com/ts-76/void-plugin-hono-jsx/tree/main/fixtures/static).

## Optional Markdown

Install these peers only when using Markdown. Applications without Markdown do not install them:

```sh
npm install @ts-76/hono-markdown@^0.3.0 yaml@2.9.1 shiki@4.6.0 @shikijs/transformers@4.6.0
```

`@ts-76/hono-markdown` 0.3.0 or newer is required for its island and fence-range security fixes. It installs its own parser dependencies.

Add `voidHonoMarkdown()` from `void-plugin-hono-jsx/markdown/plugin` after `voidHonoJsx()`.
It supports frontmatter, layouts, loaders, islands, Shiki highlighting, copy buttons and five container types.
Import `void-plugin-hono-jsx/theme-content.css` and wrap Markdown in `.void-md` for scoped styles.

Markdown uses document navigation and preserves authored HTML. Use trusted content; no HTML sanitization is provided.
The [Markdown fixture](https://github.com/ts-76/void-plugin-hono-jsx/tree/main/fixtures/markdown) exercises static components and explicit islands. Host syntax and context are supplied by `@ts-76/hono-markdown`; install optional highlighting peers when enabling highlighting.

For portable compilation outside Void, import `@ts-76/hono-markdown/compiler`. Its documents share the Markdown context with `void-plugin-hono-jsx/markdown`.
`void-plugin-hono-jsx/markdown/client` connects standalone Markdown islands to Void's scheduler. Hosts supply a `ready` gate for presentation-specific activation.

## Hono CSS

The adapter collects default `hono/css` rules into one `style#hono-css` in head, before application stylesheets. Pages and islands reuse this host; static pages need no client JavaScript for their CSS. Do not render Hono's `<Style />` inside a page or layout.

For a per-response CSP nonce, render `<HonoStyles nonce={nonce} />` from `void-plugin-hono-jsx` in the SSR tree. It configures the head host and adds no element inside the client root. Use one nonce per document; SPA navigation retains the initial host and nonce. Pass the same nonce in the response's CSP header. CSP nonce setup for client-only shells is not provided.

This integration covers the default CSS context. Custom `createCssContext()` hosts need their own lifecycle. Hono may register initial SSR rules again on first client render; subsequent visits reuse its registry. Exact SSR-to-client rule deduplication is not guaranteed.

## Source and debugging files

The package includes TypeScript source under `src`, JavaScript source maps and declaration maps.
Use the documented package exports for application imports.

## Compatibility and rendering limits

- Browser mounting redraws SSR content; DOM reuse and pre-mount input/focus preservation are not guaranteed.
- Editing an island component in development renders its mounted islands again without a document reload; island state resets. Other development edits reload the document and reset local state.
- Failed deferred prefetch can resolve to `null`.
- A local Void/Miniflare connection-reuse issue remains unresolved after some rejected POSTs.
- Direct Workers ISR path purge enumerates eventually consistent KV keys and may miss recent query variants. Immediate or global invalidation and single-flight regeneration are not guaranteed.
- The managed Void platform is unverified.

## Security

The locked Void 1.6.2 dependency trees for 0.11.0 retain an upstream esbuild development-server advisory. The scoped acceptance requires keeping the affected esbuild serve feature out of use.
See the [security policy](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/SECURITY.md) and report vulnerabilities [privately](https://github.com/ts-76/void-plugin-hono-jsx/security/advisories/new).
