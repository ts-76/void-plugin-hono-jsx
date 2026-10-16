# Experimental Hono Pages adapter for Void

This experimental package integrates Hono JSX with Void Pages. The package name is `void-plugin-hono-jsx`. Alpha releases are published on the `next` dist-tag under the [MIT license](LICENSE). Use `@next` or an explicit alpha version. The maintainer also assigned `latest` to the published `0.1.0-alpha.1`; an unqualified install currently selects this experimental alpha, not a stable release. It is not an official Void adapter.

## Supported versions

| Component | Accepted stable range | Full consumer fixtures |
| --- | --- | --- |
| Node.js | >=24.21.0 | 24.21.0 |
| Void | >=0.26.1 <0.28.0 | 0.26.1, 0.27.0 |
| Hono | >=4.13.13 <5.0.0 | 4.13.13 |
| Vite | >=8.0.16 <9.0.0 | 8.0.16 (Vite Plus), 8.3.3, 8.3.4 |
| Vite Plus | Host Vite must satisfy the Vite range | 0.1.24 (scaffold), 1.1.0 (latest) |
| TypeScript | Project tooling | 7.0.2 |

Published alpha.3 includes these peer ranges, running-Vite diagnostics and packaged source/maps. Alpha.1 and alpha.2 retain their exact-version gate. Stable Vite/Hono updates within the accepted ranges are admitted by compatibility policy; Void 0.28 and later require explicit validation. Prereleases are excluded. The fixture versions above are the 2026-10-12 snapshot; admitting a range does not mean every future version has already been tested. New upstream releases require refreshed fixtures, full checks and dependency audit review.

This source tree also includes the next alpha's expanded Link/Form APIs, island forms and graphs, deferred contracts, page options and optional Markdown. Use a local tarball to test these additions until the next alpha is published; installing the currently published alpha.3 does not provide them.

## Install

Use Node 24.21.0 or newer:

```sh
npm install void-plugin-hono-jsx@next hono@4.13.13
npm install --save-dev void@0.27.0 vite@8.3.4 typescript@7.0.2
```

For a local validation tarball, in the repository, run `npm ci`, `npm run build:package`, then `npm pack ./packages/hono-pages`. Install the resulting tarball in your project alongside the supported peer versions:

```sh
npm install ./void-plugin-hono-jsx-<version>.tgz hono@4.13.13
npm install --save-dev void@0.27.0 vite@8.3.4 typescript@7.0.2
```

## Configure

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoPages } from 'void-plugin-hono-jsx/plugin';

export default defineConfig({ plugins: [voidPlugin(), voidHonoPages()] });
```

Configure project settings in `void.config.ts` using `defineConfig` from `void/config`. Run Vite from that project's root. `voidHonoPages()` includes the Hono JSX transform, so do not register a separate transform. Configure charset, viewport and favicon through Void's `head` settings.

Use `jsx: "react-jsx"` and `jsxImportSource: "hono/jsx"` in TypeScript. The plugin chooses the server or DOM factory for application JSX; the plugin resolves package runtime exports using Vite's actual consumer environment. Cloudflare worker environments may enable the browser condition, so that condition alone cannot select the renderer.

## Running Vite and launcher diagnostics

The config hook reads `this.meta.viteVersion` from the Vite instance executing the hook. Resolving `vite/package.json` from the adapter or project is not evidence of the running host. The adapter also checks the actual Vite helper module it imports. Errors include the host version, helper version, and absolute adapter/project package.json paths; different pnpm peer copies therefore remain visible.

Bundled launchers such as `vp dev` can execute another Vite even when the project has a direct `vite` dependency. The Void 0.27.0 scaffold requests `vite-plus: ^0.1.21`, resolving to 0.1.24 with host Vite 8.0.16. Latest Vite Plus 1.1.0 runs host Vite 8.3.3. The scaffold fixture retains direct npm Vite 8.3.4. Latest Vite Plus requires its official aligned toolchain: `vite` aliases `npm:@voidzero-dev/vite-plus-core@1.1.0`, and the fixture follows its documented consumer-only Vite/Vitest overrides (Vitest 5.0.3). Both are exercised in independent locked consumers, including dev, build and preview. These settings align the toolchain; they do not replace vulnerable transitive dependencies. Standard Vite 8.3.3/8.3.4 is also covered. Installing project Vite alone does not change a bundled host; unsupported host errors identify the launcher action separately from stale helper peer resolution.

If the project version is already correct, inspect the paths in the diagnostic and refresh stale adapter peer resolutions/lockfiles. Do not infer the host identity from the project dependency alone. Missing hook version information fails closed. [Vite plugin context metadata](https://vite.dev/guide/api-plugin.html#plugin-context-meta)

## Adapting a Void scaffold

Void's init wizard currently offers React, Vue, Svelte and Solid adapters rather than Hono JSX. A React scaffold can be adapted without replacing its Vite Plus scripts:

1. Install this adapter and `hono`; use a candidate/new release with the support policy above.
2. Replace `voidReact()` / `@void/react/plugin` in `vite.config.ts` with `voidHonoPages()` / `void-plugin-hono-jsx/plugin`, keeping `voidPlugin()`.
3. Set TypeScript `jsx` to `react-jsx` and `jsxImportSource` to `hono/jsx`. Change page/component React imports and hooks to Hono JSX APIs.
4. Once React code is removed, uninstall `@void/react`, `react`, `react-dom`, `@types/react`, `@types/react-dom` and `oxc-transform-react` if they are otherwise unused. The Hono plugin supplies its own JSX transform.
5. Keep `vp dev`, `vp build`, `vp preview`, or use the plain Vite scaffold. Verify the app's loaders/actions and database migrations locally.

The latest consumer fixtures also install React scaffold dependencies (React/DOM/types 19.3.0, `@void/react` 0.27.0 and `oxc-transform-react` 0.153.0), showing that their presence does not block the Hono adapter. This is not a React-to-Hono source conversion or a claim that other UI frameworks run through this adapter.

## Source and debugging files

Published alpha.2 and alpha.3 include the original `src/plugins/*.ts` and `src/runtime/*.{ts,tsx}` alongside compiled `dist` entries. Every JavaScript file has a `.js.map` with embedded original source; every declaration has a `.d.ts.map` pointing to the same packaged TypeScript files. Build-time import rewriting composes its map with the compiler map, so generated locations still refer to the original source. Alpha.0 and alpha.1 retain their original dist-only archives.

Read source under `node_modules/void-plugin-hono-jsx/src`. Editors supporting declaration maps can navigate from exported types to those files, and debuggers/bundlers supporting source maps can show the original source. Application imports continue to use `/plugin`, `/pages` and `/form`; `src` is supplied for inspection and debugging, not as an additional runtime entry point. Candidate and clean-consumer checks reject missing/stale maps, external source references, changed source bytes and unexpected archive files.

## Runtime exports

```tsx
import { Link, useRouter, useShared, useParams, useErrors, useNavigation } from 'void-plugin-hono-jsx/pages';
import { Form, useForm, useIslandForm, action } from 'void-plugin-hono-jsx/form';
```

`Link` and `useRouter` use Void's shared navigation protocol. Link accepts `method`, `data`, `preserveScroll`, `preserveState`, `replace`, `reloadDocument` and cancellable `onNavigate`. GET data is serialized into its href; mutation links render buttons. Prefetch supports `true` (hover), `hover`, `click`, `mount`, `visible` or an array, with optional `cacheFor`. Prefetch and document reload are GET-only. User event handlers can prevent the adapter's action; external/download/target links retain native behavior. Ordinary GET visits reset page state; refresh preserves it. Root/nested/named layouts retain state while they remain in the active chain. Shared data, route params and field errors are available in SSR and browser components. `useNavigation()` returns Void's reactive `{ state, location, method }` (`idle`, `loading`, `submitting`); SSR starts idle and pending visits clear on completion, failure or cancellation. `useForm` supports all mutation methods, named actions, validation, duplicate suppression and cancellation. Existing `useForm(defaults)` with `post(url)` remains supported. The bound `useForm('/edit?save', defaults, options)` form also supports `post()`/`put()`/`patch()`/`delete()` and `<Form form={form}>`; provide `url` to Form for a legacy unbound model. `setData` accepts a complete object/updater or a typed field/value pair. `hasChanges`, `recentlySuccessful` (two seconds), selective `reset`/`clearErrors`, and `clearError` describe and reset state. A successful bound submission becomes the new defaults. `Form` displays field/action errors (customizable with `renderError`), respects quota retry deadlines, and never automatically resubmits. The typed `action(url, options)` helper performs a single action through the initialized Pages router. Cancellation does not undo server writes.

Head resolution and escaping follow Void. The adapter synchronizes document attributes and inert script metadata; navigation does not execute newly inserted scripts. Raw `script.innerHTML` is authored content. Serialize dynamic JSON-LD and escape `<` before assigning it.

## Static output and prerendering

Set `output: 'static'` in `void.config.ts`, then run `vite build`. Void collects known page routes and dynamic `getPrerenderPaths()` results and generates HTML plus `/_void/pages/*.json` under `dist/client`. The Hono adapter supplies its renderer and enables the shared router's static-data mode. It adds no route crawler.

```ts
// pages/users/[id].server.ts
import { defineHandler } from 'void';
export const prerender = true;
export const getPrerenderPaths = () => [{ id: 'alice' }, { id: 'bob' }];
export const loader = defineHandler((c) => ({ id: c.req.param('id') }));
```

Known routes auto-prerender in static output. `prerender = true` explicitly selects a route; `prerender = false` excludes it. Excluded routes and undeclared dynamic paths have no generated HTML or page-data file and require a server to work. Serve `dist/client` with clean URL mapping such as `/users/alice` to `users/alice.html`, including the generated assets and `/_void/pages` JSON files. Direct requests, reload and counters use the generated output; Pages links fetch the static JSON and keep the document.

Actions and named actions require a server. The plugin rejects them during static discovery. Deferred props are unsupported in static output and produce an explicit renderer error. Void 0.26.1 reports failed prerender paths as warnings, continues the build, and omits that path's HTML; verify the expected file set before release. The consumer check exercises both diagnostics and rejects any unexpected prerender failures in the supported fixture.

`fixtures/static` demonstrates loader-backed counters, declared dynamic paths and true/false overrides. `scripts/check-static-consumer.mjs`, called by `npm run check:consumer`, builds with Void's own collection and serves only generated files. ISR, CDN configuration and managed deployment are separate follow-up work.

## Deferred loader props

Return `defer(() => slowOperation())` from a Void loader. The public Hono `Deferred<T>` type is Void's `DeferredState<T>` discriminated union. Read its readonly `loading`, `error` and `value` fields:

```tsx
import type { Deferred } from 'void-plugin-hono-jsx/pages';
function Result({ slow }: { slow: Deferred<string> }) {
  if (slow.loading) return <p>Loading</p>;
  if (slow.error) return <p role="alert">{slow.error.message}</p>;
  return <p>{slow.value}</p>;
}
```

The server renders immediate props and a loading state before the resolver completes. Deferred pages load the Pages entry asynchronously, so Hono can mount while the initial HTML stream is open. Initial HTML callbacks and SPA NDJSON responses use Void's existing protocol and deferred registry. During initial component imports, the adapter buffers early completions in Void's existing queue and drains them when the registry is ready.

A resolved value or error updates the current page without resetting page-local state or surviving layouts. Updates from a pending page are ignored until that page commits. Void aborts and disposes old navigation resources; the adapter additionally accepts only updates belonging to the rendered props object.

Void 0.26.1 forwards ordinary deferred resolver error messages in development; production streams use `Internal Server Error`. Deliberate HTTP exception messages may be forwarded in production. The adapter turns the received message into an `Error` and exposes it through `error`; server stack traces are not included. Author deliberate HTTP exception messages suitable for display to users. This follows the verified streaming error behavior of the pinned Void version.

The verified contract covers single and grouped deferred props during GET document requests and SPA navigation, successful prefetch followed by a visit, and retention of resolved values after actions. Void preserves these values until the next load/navigation; mutation actions do not rerun the deferred resolver. Failed deferred prefetch currently becomes a resolved `null` because Void does not transmit its error; use document/SPA streaming when error state is required. Grouped resolver projections require explicit prop types with the current Void `defer<T>` declaration. Deferred island pages and static deferred output remain unsupported. The ordinary Pages action APIs remain documented under runtime exports.

## Islands

Use a `.island.tsx` or `.island.jsx` page for static server content and import an interactive component using Void's import attribute:

```tsx
import Counter from '../components/Counter' with { island: 'load' };
export const layout = false;
export default function Page() {
  return <main><p>Static server content</p><Counter initialCount={9} message="Hello" /></main>;
}
```

Place the counter outside the pages directory. It can use Hono hooks and event handlers normally. The adapter renders its initial HTML inside Void's `data-island`, `data-hydrate` and `data-props` markers, then uses `initIslands` to load and mount only interactive components. Props must be JSON-serializable values. Hono escapes the JSON attribute; parsed browser props match the server values. Mounting redraws the island contents. It does not reuse the server DOM.

A static-only island page emits no client script or module preload tags. Static page modules stay outside the normal Pages browser manifest. A project containing only static island pages builds empty client entry modules with no framework code. Void's own automatic prerender policy still applies to eligible island pages. Full static output and explicit prerender configuration follow the static output contract below.

The `load`, `visible`, `idle` and `media:(query)` policies use Void's shared scheduler. Use a single default relative TSX/JSX import, with attributes directly in the island page. Unknown policies and obvious malformed media queries fail discovery; the browser checks the media query through CSSOM before scheduling. Each island mounts once when its condition is met. Island layouts and attributed imports in their static TSX/JSX component graph are supported, including named layouts and repeated components with independent JSON props. The graph handles cycles and invalidates island entries when a known static component changes. Static chains without interactive imports emit no client script. Interactive components form a boundary: use ordinary imports inside them; another attributed island inside an already interactive component is rejected to avoid overlapping mounts. Full Pages cannot inherit an island layout (Void diagnoses the mixed mode). `useIslandForm(defaults)` provides the same data/dirty/error/submit/reset/clear state without a Pages provider. Submit to an explicit same-origin URL, or use `<Form form={form} url="/blog?save">`. Island success reloads or redirects the document, so state is rebuilt from SSR props. Duplicate submissions are suppressed; cancellation aborts the owned fetch but does not roll back a server write. Fields are sent as JSON. Ordinary `useForm` and the one-shot Pages `action` still require full Pages; use named imports of `useIslandForm`/`Form` in islands. Pages-only form imports (`useForm`, `action`) and ambiguous namespace/default form imports fail with a diagnostic in an island page or component. `useForm` also requires a full Pages provider at runtime. Use ordinary document links in static island pages. Pages navigation falls back to a document request for island routes. Static layouts remain server content and do not retain interactive state.

## Experimental limitations

The virtual renderer/client entries follow version-specific conventions observed in Void's official adapter rather than a documented third-party registration API. Browser mounting redraws the SSR page; DOM reuse is not guaranteed. Local ISR uses Void's native direct-worker KV/Cache API runtime; managed edge behavior remains unverified. Unsupported modes fail clearly. Package publication and repository visibility are separate maintainer decisions.

## Known upstream dependency advisory

The initial alpha accepts [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) as a known limitation on the pinned peer baseline. The reviewed audits on 2026-10-11 reported Moderate findings propagated across multiple package entries from this single esbuild advisory; package-entry counts can differ between audit reports. The affected esbuild 0.18.20 is installed through Void 0.26.1 → drizzle-kit 0.31.11 → @esbuild-kit/esm-loader 2.6.5 → @esbuild-kit/core-utils 3.3.2.

The advisory concerns esbuild's own development server. The adapter uses Vite/Oxc for JSX and TypeScript for package compilation; the inspected upstream loader uses esbuild transforms. No esbuild serve invocation was found in the adapter or these loader modules, but other upstream commands and consumer configurations have not been exhaustively assessed. Avoid the affected esbuild serve feature. This is an accepted audit finding, not a claim of overall security or an audit-zero result.

The package adds no overrides and does not force changes to Void's internal dependencies. Consumers install the framework peers and their dependencies even though this archive contains no dependency implementation. Follow compatible upstream fixes; a peer upgrade requires renewed validation. New unreviewed advisories continue to block release preparation policy.

The scaffold Vite Plus 0.1.24 additionally brings `oxfmt 0.52.0 → tinypool 2.1.0`. On 2026-10-12 its consumer audit reported three propagated Critical package entries from [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) and [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr). These require prototype pollution followed by pool worker creation/run options; `oxfmt/dist/cli.js` imports Tinypool. Dev/build/preview worked, but that does not prove formatter paths safe. These advisories are unapproved and continue to block that stack's release plan. Prefer latest Vite Plus 1.1.0 with its aligned alias or plain Vite; both retain only the existing esbuild advisory in reviewed audits. No tinypool override or security exception was added. See the repository `docs/scaffold-compatibility.md` for the complete matrix and audit assessment.

## Verification

`npm run check:consumer` packs the package, audits its file list, copies a fixture into a temporary directory, installs locked peer dependencies and the tarball, and checks types, development rendering, production build, preview rendering and browser interaction. The consumer uses only the documented package exports and does not import repository source files.

Repository: https://github.com/ts-76/void-plugin-hono-jsx

### Development reload and compatibility

Page and companion-loader edits reload the document and reset page/layout state. This is not state-preserving HMR. Added and removed page files update Void's route manifest without restarting the server. The adapter clears its discovery cache and uses Void's existing structural reload notifications; sending a second worker reload can mix SSR module instances during a request.

In development, the SSR renderer eagerly imports server-rendered page and layout modules with their providers. This keeps in-flight requests within the same module generation during a reload. Server-side module initialization therefore happens when the renderer loads, including pages not yet visited. Browser-only page components are excluded from this server graph. Production keeps lazy component imports. The packed-consumer regression also sends parallel SSR requests during six simultaneous page/loader revisions and requires every response to succeed.

The packed-consumer check edits a page, changes its loader value, adds and removes a route, checks counter interaction after reloading, and asserts that the server stays running. It also verifies resolved dependency paths and rejection of an unsupported running Vite even when a supported npm Vite is installed. Five locked consumers cover the original baseline, the Vite patch update, latest Void with plain Vite, the scaffold Vite Plus, and latest Vite Plus on Node 24.21.0. The existing required baseline context aggregates all five results. It also runs `npm run check:source` for navigation, persistent layouts, action forms and head metadata in development and production preview. Inspect the GitHub Actions result on the commit being reviewed.

## Local ISR

For server output, set `routing.revalidate` in `void.config.ts` and override a page with `export const revalidate` in its companion server module. The adapter uses Void's existing cache runtime. The packed-consumer check verifies fresh and stale HTML, background regeneration, page/global/zero policies, retained valid HTML after regeneration failure, safe props, asset references and browser interaction.

The fixture binds local `ISR_CACHE` storage for Void production preview. Real deployments require Void's cache bindings; the fixture's placeholder ID and test control API are for local checks only. Managed edge, cross-data-center invalidation and production KV behavior remain unverified. ISR requires a worker/cache runtime; static output is served as generated files. See the repository `docs/isr.md` and [Void revalidation guide](https://void.cloud/guide/edge/revalidation).

## Known local development limitation

On the tested macOS Void/Miniflare development runtime, a POST to an undefined named action can reset the next request on a reused connection. Declared-action browser behavior is verified; this transport edge case remains unresolved upstream. Managed runtime behavior for the edge case is unverified. Review this limitation before adopting the initial alpha.
