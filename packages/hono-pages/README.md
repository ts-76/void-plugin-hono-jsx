# Experimental Hono Pages adapter for Void

This private validation package integrates Hono JSX with Void Pages. The package name is `void-plugin-hono-jsx`. It is unpublished and distributed under the [MIT license](LICENSE). Publication remains a separate maintainer decision. It is not an official Void adapter.

## Supported versions

| Dependency | Verified version |
| --- | --- |
| Node.js | 24.21.0 or newer |
| Void | 0.26.0 |
| Hono | 4.13.13 |
| Vite | 8.3.3 |

Framework packages are exact peer dependencies. Other versions have not been validated; configuration fails with an install command when Void, Hono or Vite differs from this baseline.

## Install the validation tarball

In the repository, run `npm ci`, `npm run build:package`, then `npm pack ./packages/hono-pages`. Install the resulting tarball in your project alongside the supported peer versions:

```sh
npm install ./void-plugin-hono-jsx-0.0.0.tgz hono@4.13.13
npm install --save-dev void@0.26.0 vite@8.3.3 typescript@7.0.2
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

## Runtime exports

```tsx
import { Link, useRouter, useShared, useParams, useErrors } from 'void-plugin-hono-jsx/pages';
import { useForm } from 'void-plugin-hono-jsx/form';
```

`Link` and `useRouter` use Void's shared navigation protocol. Ordinary GET visits reset page state; refresh preserves it. Root/nested/named layouts retain state while they remain in the active chain. Shared data, route params and field errors are available in SSR and browser components. `useForm` supports all mutation methods, named actions, validation, duplicate suppression and cancellation. Cancellation does not undo server writes.

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

Actions and named actions require a server. The plugin rejects them during static discovery. Deferred props are unsupported in static output and produce an explicit renderer error. Void 0.26.0 reports failed prerender paths as warnings, continues the build, and omits that path's HTML; verify the expected file set before release. The consumer check exercises both diagnostics and rejects any unexpected prerender failures in the supported fixture.

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

Void 0.26.0 forwards deferred resolver error messages in development and production streams. The adapter turns that message into an `Error` and exposes it through `error`; server stack traces are not included. Author resolver messages suitable for display to users. This follows the observed streaming error behavior of the pinned Void version.

The verified contract covers single deferred props during GET document requests and SPA navigation. Grouped deferred props, deferred prefetching, mutation-driven deferred refresh and deferred island pages are excluded. The ordinary Pages action APIs remain documented under runtime exports.

## Load-policy islands

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

Only the `load` policy, a single default relative TSX/JSX import, and attributes directly in the island page are supported. Other policies and malformed imports fail during discovery. Island layouts, nested attributed imports and island form helpers are unsupported. Direct imports of `void-plugin-hono-jsx/form` in an island page or component fail with a diagnostic; `useForm` also requires a full Pages provider at runtime. Use ordinary document links in static island pages. Pages navigation falls back to a document request for island routes. Static layouts remain server content and do not retain interactive state.

## Experimental limitations

The virtual renderer/client entries follow version-specific conventions observed in Void's official adapter rather than a documented third-party registration API. Browser mounting redraws the SSR page; DOM reuse is not guaranteed. Local ISR uses Void's native direct-worker KV/Cache API runtime; managed edge behavior remains unverified. Unsupported modes fail clearly. Package publication and repository visibility are separate maintainer decisions.

## Verification

`npm run check:consumer` packs the package, audits its file list, copies a fixture into a temporary directory, installs locked peer dependencies and the tarball, and checks types, development rendering, production build, preview rendering and browser interaction. The consumer uses only the documented package exports and does not import repository source files.

Repository: https://github.com/ts-76/void-hono-jsx-poc

### Development reload and compatibility

Page and companion-loader edits reload the document and reset page/layout state. This is not state-preserving HMR. Added and removed page files update Void's route manifest without restarting the server. The adapter clears its discovery cache and uses Void's existing structural reload notifications; sending a second worker reload can mix SSR module instances during a request.

The packed-consumer check edits a page, changes its loader value, adds and removes a route, checks counter interaction after reloading, and asserts that the server stays running. It also verifies actionable diagnostics for unverified Void, Hono and Vite versions. Development and production preview are exercised on the exact baseline above; no additional framework versions are claimed. The prepared CI workflow covers that baseline on Node 24.21.0, but workflow activation and an actual GitHub Actions run remain pending the authentication scope update.

## Local ISR

For server output, set `routing.revalidate` in `void.config.ts` and override a page with `export const revalidate` in its companion server module. The adapter uses Void's existing cache runtime. The packed-consumer check verifies fresh and stale HTML, background regeneration, page/global/zero policies, retained valid HTML after regeneration failure, safe props, asset references and browser interaction.

The fixture binds local `ISR_CACHE` storage for Void production preview. Real deployments require Void's cache bindings; the fixture's placeholder ID and test control API are for local checks only. Managed edge, cross-data-center invalidation and production KV behavior remain unverified. ISR requires a worker/cache runtime; static output is served as generated files. See the repository `docs/isr.md` and [Void revalidation guide](https://void.cloud/guide/edge/revalidation).
