# Hono JSX adapter for Void Pages

This package integrates Hono JSX with Void Pages. The normal 0.1.x series is published under the [MIT license](LICENSE). Install the default package below; `latest` selects the publicly verified normal release. `next` may select a prerelease during later release cycles. Normal releases are promoted after public artifact/consumer verification. Historical alpha releases have a different compatibility contract. This is not an official Void adapter.

## Supported versions

| Component | Accepted stable range | Full consumer fixtures |
| --- | --- | --- |
| Node.js | >=24.21.0 <25.0.0 | 24.21.0 |
| Void | >=1.1.11 <1.2.0 | 1.1.11 |
| Hono | >=4.13.13 <5.0.0 | 4.13.13 |
| Vite | >=8.0.16 <9.0.0 | 8.3.4 |
| Vite Plus | Host Vite must satisfy the Vite range | 1.3.0 |
| TypeScript | Project tooling | 7.0.2 |

The normal 0.1.x series targets Void 1.1 and Node 24 only. Published alpha.4 retains its earlier Void 0.x contract; it does not provide this support change or multipart transport. Old Void/launcher manifests remain historical comparison records, not release-selectable configurations. The two supported Hono-only consumers use Void 1.1.11 with plain Vite 8.3.4 or aligned Vite Plus 1.3.0 (host Vite 8.3.4). Ranges admit stable updates, but only locked fixtures are observed test results. New upstream releases require refreshed fixtures, full checks and audit review; prereleases and other Void minors are excluded.

The normal 0.1.x series includes the expanded Link/Form APIs, multipart transport, island forms and graphs, deferred contracts with deferredResult/use/Suspense, navigation fallback, page options and optional Markdown. These instructions describe that normal series; historical alpha releases do not provide the same Void 1.1 contract.

## Install

Use Node 24.21.0 or newer within Node 24. The unqualified package selects the normal release on `latest`. To reproduce the first normal release, install `void-plugin-hono-jsx@0.1.0`; use `@next` only when deliberately testing the currently approved candidate.

The commands below use the supported Void 1.1 baseline. Local tarballs remain available for source verification.

```sh
npm install void-plugin-hono-jsx hono@4.13.13
npm install --save-dev void@1.1.11 vite@8.3.4 typescript@7.0.2
```

For a local validation tarball, in the repository, run `npm ci`, `npm run build:package`, then `npm pack ./packages/hono-pages`. Install the resulting tarball in your project alongside the supported peer versions:

```sh
npm install ./void-plugin-hono-jsx-<version>.tgz hono@4.13.13
npm install --save-dev void@1.1.11 vite@8.3.4 typescript@7.0.2
```

## Configure

`voidHonoJsx()` and `HonoJsxOptions` replace the earlier `voidHonoPages()` and `HonoPagesOptions` names. This is a breaking alpha API change; the old names are not exported. Alpha.3 uses the earlier names; the normal 0.1.x series exports the new names shown below.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoJsx } from 'void-plugin-hono-jsx/plugin';

export default defineConfig({ plugins: [voidPlugin(), voidHonoJsx()] });
```

Configure project settings in `void.config.ts` using `defineConfig` from `void/config`. Run Vite from that project's root. `voidHonoJsx()` includes the Hono JSX transform, so do not register a separate transform. Configure charset, viewport and favicon through Void's `head` settings.

Use `jsx: "react-jsx"` and `jsxImportSource: "hono/jsx"` in TypeScript. The plugin chooses the server or DOM factory for application JSX; the plugin resolves package runtime exports using Vite's actual consumer environment. Cloudflare worker environments may enable the browser condition, so that condition alone cannot select the renderer.

## Running Vite and launcher diagnostics

The config hook reads `this.meta.viteVersion` from the Vite instance executing the hook. Resolving `vite/package.json` from the adapter or project is not evidence of the running host. The adapter also checks the actual Vite helper module it imports. Errors include the host version, helper version, and absolute adapter/project package.json paths; different pnpm peer copies therefore remain visible.

Bundled launchers such as `vp dev` can execute another Vite even when a direct npm `vite` is installed. The supported Vite Plus 1.3.0 configuration aliases `vite` to `npm:@voidzero-dev/vite-plus-core@1.3.0` and uses `overrides: { vite: "$vite" }` to keep helper and host peers aligned. The real config-hook host is Vite 8.3.4. Plain Vite 8.3.4 is independently exercised. Installing npm Vite alone does not change a bundled host; diagnostics identify launcher and helper peer paths separately. Historical 0.x scaffold settings are outside the normal 0.1.x support policy. The alias aligns the launcher; it is not a vulnerability override.

If the project version is already correct, inspect the paths in the diagnostic and refresh stale adapter peer resolutions/lockfiles. Do not infer the host identity from the project dependency alone. Missing hook version information fails closed. [Vite plugin context metadata](https://vite.dev/guide/api-plugin.html#plugin-context-meta)

## Adapting a Void scaffold

Void's init wizard currently offers React, Vue, Svelte and Solid adapters rather than Hono JSX. A React scaffold can be adapted without replacing its Vite Plus scripts:

1. Install this adapter and `hono`; use a candidate/new release with the support policy above.
2. Replace `voidReact()` / `@void/react/plugin` in `vite.config.ts` with `voidHonoJsx()` / `void-plugin-hono-jsx/plugin`, keeping `voidPlugin()`.
3. Set TypeScript `jsx` to `react-jsx` and `jsxImportSource` to `hono/jsx`. Change page/component React imports and hooks to Hono JSX APIs.
4. Once React code is removed, uninstall `@void/react`, `react`, `react-dom`, `@types/react`, `@types/react-dom` and `oxc-transform-react` if they are otherwise unused. The Hono plugin supplies its own JSX transform.
5. Keep `vp dev`, `vp build`, `vp preview`, or use the plain Vite scaffold. Verify the app's loaders/actions and database migrations locally.

The supported RC fixtures are Hono-only. Historical React/Void 0.x scaffold metadata is retained for comparison and is not a supported installation path.

## Source and debugging files

Published alpha.2 and alpha.3 include the original `src/plugins/*.ts` and `src/runtime/*.{ts,tsx}` alongside compiled `dist` entries. Every JavaScript file has a `.js.map` with embedded original source; every declaration has a `.d.ts.map` pointing to the same packaged TypeScript files. Build-time import rewriting composes its map with the compiler map, so generated locations still refer to the original source. Alpha.0 and alpha.1 retain their original dist-only archives.

Read source under `node_modules/void-plugin-hono-jsx/src`. Editors supporting declaration maps can navigate from exported types to those files, and debuggers/bundlers supporting source maps can show the original source. Application imports continue to use `/plugin`, `/pages` and `/form`; `src` is supplied for inspection and debugging, not as an additional runtime entry point. Candidate and clean-consumer checks reject missing/stale maps, external source references, changed source bytes and unexpected archive files.

## Runtime exports

```tsx
import { Link, useRouter, useShared, useParams, useErrors, useNavigation } from 'void-plugin-hono-jsx/pages';
import { Form, useForm, useIslandForm, action } from 'void-plugin-hono-jsx/form';
```

`Link` and `useRouter` use Void's shared navigation protocol. Link accepts `method`, `data`, `preserveScroll`, `preserveState`, `replace`, `reloadDocument` and cancellable `onNavigate`. GET data is serialized into its href; mutation links render buttons. Prefetch supports `true` (hover), `hover`, `click`, `mount`, `visible` or an array, with optional `cacheFor`. Prefetch and document reload are GET-only. User event handlers can prevent the adapter's action; external/download/target links retain native behavior. Ordinary GET visits reset page state; refresh preserves it. Root/nested/named layouts retain state while they remain in the active chain. Shared data, route params and field errors are available in SSR and browser components. `useNavigation()` returns Void's reactive `{ state, location, method }` (`idle`, `loading`, `submitting`); SSR starts idle and pending visits clear on completion, failure or cancellation. `useForm` supports all mutation methods, named actions, validation, duplicate suppression and cancellation. Existing `useForm(defaults)` with `post(url)` remains supported. The bound `useForm('/edit?save', defaults, options)` form also supports `post()`/`put()`/`patch()`/`delete()` and `<Form form={form}>`; provide `url` to Form for a legacy unbound model. `setData` accepts a complete object/updater or a typed field/value pair. `hasChanges`, `recentlySuccessful` (two seconds), selective `reset`/`clearErrors`, and `clearError` describe and reset state. A successful bound JSON submission becomes the new defaults. `Form` displays field/action errors (customizable with `renderError`), respects quota retry deadlines, and never automatically resubmits. The typed `action(url, options)` helper performs a single action through the initialized Pages router. Cancellation does not undo server writes.

Head resolution and escaping follow Void. The adapter synchronizes document attributes and inert script metadata; navigation does not execute newly inserted scripts. Raw `script.innerHTML` is authored content. Serialize dynamic JSON-LD and escape `<` before assigning it.

If a page or layout throws during browser rendering, the visit rejects and navigation returns to idle. The URL and head remain on the last successful page. Recovery rebuilds that page and its layouts, resetting their local component state; a later visit can proceed normally. State preservation during successful navigation is unchanged.

### Multipart forms (unreleased)

JSON remains the default: `<Form form={form}>` sends `form.data`. Opt into browser form fields with `encType="multipart/form-data"`. Give inputs a `name`; files, repeated names and the clicked submit button are included without converting them into a JSON object.

```tsx
const form = useForm('/profile?save', { name: 'Initial' });
return <Form form={form} encType="multipart/form-data">
  <input name="name" value="Native field" />
  <input name="files" type="file" multiple />
  <button name="intent" value="save">Save</button>
</Form>;
```

For direct calls use `form.post(data)` on a bound form, `form.post('/profile?save', data)` with an explicit URL, or `form.submit('patch', data)`. All four mutation methods accept FormData. Unbound forms require a URL. For an island, use `useIslandForm(defaults)` and `<Form form={form} url="/profile?save" encType="multipart/form-data">`.

The adapter snapshots FormData at submission and leaves `Content-Type` unset so fetch generates the multipart boundary. Validation retains native field/file values. FormData submission does not replace the JSON model or its defaults: `data`, `hasChanges` and `reset()` continue to describe the JSON model, not uncontrolled DOM/file inputs. Use the native form's reset operation to clear those controls. Cancellation prevents a late response from updating the view, but cannot undo a server write.

Full Pages multipart uses a dedicated same-origin mutation request followed by **one explicit GET** through Void's public router on success. Void's public engine cannot consume a raw multipart body or an externally fetched page shell. The GET commits through normal Hono rendering, history, layout/head, navigation state and cancellation checks while preserving component state. It also reruns loaders and may re-evaluate deferred data; the resolved-deferred retention contract for JSON mutations does not apply to multipart. The destination must support a GET. Island multipart retains its existing success behavior: reload or redirect the document.

This API is included in RC.1 and is not in published alpha.4. It does not add a multipart-capable public transport hook to Void or change the one-shot `action()` helper's body contract.

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

Actions and named actions require a server. The plugin rejects them during static discovery. Deferred props are unsupported in static output and produce an explicit renderer error. The tested Void runtime reports failed prerender paths as warnings, continues the build, and omits that path's HTML; verify the expected file set before release. The consumer check exercises both diagnostics and rejects any unexpected prerender failures in the supported fixture.

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

The tested Void runtime forwards ordinary deferred resolver error messages in development; production streams use `Internal Server Error`. Deliberate HTTP exception messages may be forwarded in production. The adapter turns the received message into an `Error` and exposes it through `error`; server stack traces are not included. Author deliberate HTTP exception messages suitable for display to users. This follows the verified streaming error behavior of the pinned Void version.

For JSON actions, the verified contract covers single and grouped deferred props during GET document requests and SPA navigation, successful prefetch followed by a visit, and retention of resolved values after actions. Void preserves these values until the next load/navigation; mutation actions do not rerun the deferred resolver. Failed deferred prefetch currently becomes a resolved `null` because Void does not transmit its error; use document/SPA streaming when error state is required. Grouped resolver projections require explicit prop types with the current Void `defer<T>` declaration. Deferred island pages and static deferred output remain unsupported. The ordinary Pages action APIs remain documented under runtime exports.

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

The `load`, `visible`, `idle` and `media:(query)` policies use Void's shared scheduler. Use a single default relative TSX/JSX import, with attributes directly in the island page. Unknown policies and obvious malformed media queries fail discovery; the browser checks the media query through CSSOM before scheduling. Each island mounts once when its condition is met. Island layouts and attributed imports in their static TSX/JSX component graph are supported, including named layouts and repeated components with independent JSON props. The graph handles cycles and invalidates island entries when a known static component changes. Static chains without interactive imports emit no client script. Interactive components form a boundary: use ordinary imports inside them; another attributed island inside an already interactive component is rejected to avoid overlapping mounts. Full Pages cannot inherit an island layout (Void diagnoses the mixed mode). `useIslandForm(defaults)` provides the same data/dirty/error/submit/reset/clear state without a Pages provider. Submit to an explicit same-origin URL, or use `<Form form={form} url="/blog?save">`. Island success reloads or redirects the document, so state is rebuilt from SSR props. Duplicate submissions are suppressed; cancellation aborts the owned fetch but does not roll back a server write. Fields are sent as JSON by default; explicit FormData/multipart is described above. Ordinary `useForm` and the one-shot Pages `action` still require full Pages; use named imports of `useIslandForm`/`Form` in islands. Pages-only form imports (`useForm`, `action`) and ambiguous namespace/default form imports fail with a diagnostic in an island page or component. `useForm` also requires a full Pages provider at runtime. Use ordinary document links in static island pages. Pages navigation falls back to a document request for island routes. Static layouts remain server content and do not retain interactive state.

## Optional Markdown

Optional Markdown is included in the normal 0.1.x series on the Void 1.1 baseline. Add parser peers explicitly only when using Markdown:

```sh
npm install markdown-exit@1.3.0 yaml@2.9.1
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

Create `.md` files in the Pages directory. Standard Markdown, tables, authored HTML, fenced code, heading anchors, YAML frontmatter, companion server loaders and TSX/JSX layouts are supported. Import `useFrontmatter()`, `useMarkdownHeadings()` and `useMarkdownProps()` from `void-plugin-hono-jsx/markdown` in layouts or islands. A leading `<script>` block before frontmatter may contain page-specific browser code and default relative TSX/JSX island imports. Islands use literal props and the load/visible/idle/media policies, including canonical identities for symlinked components. Frontmatter must be a JSON-serializable mapping; duplicate keys, invalid YAML and cycles fail compilation.

Markdown routes use document navigation, and static-only pages emit no executable script. Interactive/script pages reload on development edits; zero-script pages need a normal refresh. Raw HTML is preserved for repository-authored content, without sanitization for untrusted input. Markdown layout files, JSX-expression/tag-child island props, Shiki themes, footnotes, custom containers and a page-catalog virtual module are unsupported. Do not also configure `@void/md/plugin`. Ordinary Pages users do not need these parser peers. See the repository's [Markdown guide](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/markdown.md) for page examples, metadata scoping and the complete contract.

## Compatibility and rendering limits

The virtual renderer/client entries follow version-specific conventions observed in Void's official adapter rather than a documented third-party registration API. Browser mounting redraws the SSR page; DOM reuse is not guaranteed. Local ISR uses Void's native direct-worker KV/Cache API runtime; managed edge behavior remains unverified. Unsupported modes fail clearly. Package publication and repository visibility are separate maintainer decisions.

## Known upstream dependency advisory

The RC preparation reassessment on 2026-10-17 found the same single esbuild advisory on Void 1.1.11 in both supported consumers, including optional Markdown: Moderate 5 propagated entries, High/Critical 0. Its development-server path is outside the reviewed transform/loader path. No override is added. New or changed findings block upload, and fresh checks are required for every final candidate. The package does not ship the publisher tooling; its separate scoped findings do not imply a zero consumer audit. See the repository's `docs/rc-security-assessment.md` for evidence and limits.

The initial alpha accepts [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) as a known limitation on the pinned peer baseline. The reviewed audits on 2026-10-11 reported Moderate findings propagated across multiple package entries from this single esbuild advisory; package-entry counts can differ between audit reports. The affected esbuild 0.18.20 is installed through Void 0.26.1 → drizzle-kit 0.31.11 → @esbuild-kit/esm-loader 2.6.5 → @esbuild-kit/core-utils 3.3.2.

The advisory concerns esbuild's own development server. The adapter uses Vite/Oxc for JSX and TypeScript for package compilation; the inspected upstream loader uses esbuild transforms. No esbuild serve invocation was found in the adapter or these loader modules, but other upstream commands and consumer configurations have not been exhaustively assessed. Avoid the affected esbuild serve feature. This is an accepted audit finding, not a claim of overall security or an audit-zero result.

The package adds no overrides and does not force changes to Void's internal dependencies. Consumers install the framework peers and their dependencies even though this archive contains no dependency implementation. Follow compatible upstream fixes; a peer upgrade requires renewed validation. New unreviewed advisories continue to block release preparation policy.

The historical scaffold Vite Plus 0.1.24 brings unapproved tinypool Critical findings. It is outside the normal 0.1.x support policy; use the tested Vite Plus 1.3.0/core alias or plain Vite 8.3.4. Old functional CI success does not accept those findings. See the repository `docs/scaffold-compatibility.md` for historical evidence.

## Verification

`npm run check:consumer` packs the package, audits its file list, copies a fixture into a temporary directory, installs locked peer dependencies and the tarball, and checks types, development rendering, production build, preview rendering and browser interaction. The consumer uses only the documented package exports and does not import repository source files.

Repository: https://github.com/ts-76/void-plugin-hono-jsx

### Development reload and compatibility

Page and companion-loader edits reload the document and reset page/layout state. This is not state-preserving HMR. Added and removed page files update Void's route manifest without restarting the server. The adapter clears its discovery cache and uses Void's existing structural reload notifications; sending a second worker reload can mix SSR module instances during a request.

In development, the SSR renderer eagerly imports server-rendered page and layout modules with their providers. This keeps in-flight requests within the same module generation during a reload. Server-side module initialization therefore happens when the renderer loads, including pages not yet visited. Browser-only page components are excluded from this server graph. Production keeps lazy component imports. The packed-consumer regression also sends parallel SSR requests during six simultaneous page/loader revisions and requires every response to succeed.

The packed-consumer check edits pages/loaders, adds/removes routes and verifies interaction without restarting the server. It rejects old Void lines and an unsupported running Vite even when installed metadata is supported. Both required consumers use Node 24.21.0/Void 1.1.11: plain Vite 8.3.4 and Vite Plus/core 1.3.0. They run the complete dev/build/preview/browser/static/islands/deferred/Markdown/local-ISR checks on identical packed bytes. Local ISR checks do not guarantee production ISR.

## Local ISR

For server output, set `routing.revalidate` in `void.config.ts` and override a page with `export const revalidate` in its companion server module. The adapter uses Void's existing cache runtime. The packed-consumer check verifies fresh and stale HTML, background regeneration, page/global/zero policies, retained valid HTML after regeneration failure, safe props, asset references and browser interaction.

The fixture binds local `ISR_CACHE` storage for Void production preview. Real deployments require Void's cache bindings; the fixture's placeholder ID and test control API are for local checks only. Managed edge, cross-data-center invalidation and production KV behavior remain unverified. ISR requires a worker/cache runtime; static output is served as generated files. See the repository `docs/isr.md` and [Void revalidation guide](https://void.cloud/guide/edge/revalidation).

## Known local development limitation

On the tested macOS Void/Miniflare development runtime, a POST to an undefined named action can reset the next request on a reused connection. Declared-action browser behavior is verified; this transport edge case remains unresolved upstream. Managed runtime behavior for the edge case is unverified. On the RC.1 D1 fixture, an oversized-body rejection followed by another pooled request also failed locally; consuming the response body did not prevent it. Local negative checks isolate connections as a test workaround, not a repair. On 2026-10-18, direct Cloudflare HTTPS with RC.1 passed rejection/undefined-action requests followed by healthy GETs through the normal pool, without retries or Connection: close. That does not prove every environment or a forced single TCP socket. The [dated Workers record](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/cloudflare-rc1-verification.md) and [limitations ledger](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/known-limitations.md) separate observed behavior from remaining upstream diagnosis.

## Normal-release policy

The first normal release, 0.1.0, passed public bytes/signatures/provenance verification and both registry-installed consumers; latest and next were aligned to it on 2026-10-18. The [dated publication record](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/releasing.md#010-publication-and-tag-verification) identifies the exact archive and checks. Each subsequent candidate needs fresh CI/audits, stage, owner approval and public verification before normal-release tag promotion. The actual Workers/D1 migration, redeployment and cleanup exercise used RC.1; production ISR remains outside the initial guarantee. Patches in 0.1.x preserve documented APIs; breaking changes move to 0.2.0 or later. Read the [release contract](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/docs/release-contract.md) and [security policy](https://github.com/ts-76/void-plugin-hono-jsx/blob/main/SECURITY.md). Report vulnerabilities [privately](https://github.com/ts-76/void-plugin-hono-jsx/security/advisories/new).


### Common navigation fallback (included in RC.1)

Register a default-exported local TSX/JSX module by path. The plugin imports the
component into its client entry; it does not serialize a function in Vite config.

```ts
voidHonoJsx({ navigationFallback: { component: './components/NavigationFallback.tsx', delay: 150 } })
```

```tsx
import type { NavigationFallbackProps } from 'void-plugin-hono-jsx/pages';
export default function Fallback({ navigation }: NavigationFallbackProps) {
  return <p>Loading {navigation.location?.pathname}…</p>;
}
```

The optional fallback appears after 150 ms by default, only while a GET visit is
loading. Fast/cache/prefetch visits that finish before the delay show nothing.
It is an additional live status region: the existing page, input DOM and layout
remain mounted and interactive. It never replaces that tree, commits navigation
or changes history/scroll. Completion, failure and superseding visits remove it;
a new slow visit starts its own delay. If the fallback component throws, it is
hidden for that visit and reported through the existing navigation-error event;
the page tree remains mounted, and a new visit can try the fallback again.
JSON/multipart submission UI remains under
`useNavigation()`/form pending state. SSR stays idle and emits no fallback.
Without this option, existing behavior is unchanged. The normal page reset and
preserveState/preserveScroll rules still apply when the destination commits.
This addition shipped in RC.1; RC.0 does not include it.


### Hono use() / Suspense for deferred props (included in RC.1)

`deferredResult(state)` gives Hono a stable, render-only Promise. Void still runs
the resolver, delivers HTML callbacks/NDJSON and manages prefetch/navigation.
The existing `Deferred<T>` loading/value/error API remains available.

```tsx
import { ErrorBoundary, Suspense, use, useState } from 'hono/jsx';
import { deferredResult, type Deferred, type DeferredResult } from 'void-plugin-hono-jsx/pages';
function Result({ result }: { result: DeferredResult<string> }) {
  if (result.error) throw result.error;
  return <p>{result.value}</p>;
}
function Value({ slow }: { slow: Deferred<string> }) {
  const [failed, setFailed] = useState<DeferredResult<string> | null>(null);
  const result = use(deferredResult(slow));
  const fallback = <p role="alert">Could not load data.</p>;
  if (failed === result) return fallback;
  return <ErrorBoundary fallback={fallback}
    onError={() => queueMicrotask(() => setFailed(result))}>
    <Result result={result} />
  </ErrorBoundary>;
}
export default function Page({ slow }: { slow: Deferred<string> }) {
  return <Suspense fallback={<p>Loading…</p>}><Value slow={slow} /></Suspense>;
}
```

Results fulfill with `{ value, error }`. Throw the error in a child of
ErrorBoundary, after `use()` returns. The example remembers that result after
`onError`: Hono 4 can leave an incomplete tree if the same failed child is thrown
again during a parent's navigation-state update. This also keeps its async SSR
ErrorBoundary out of the pending shell. The Promise itself never rejects,
avoiding an unhandled derived rejection from Hono Suspense's `finally(retry)`.
The Promise is allocated on first use and remains identical across Void's ref
replacement and JSON action retention. Each navigation/prop owns a separate
weakly held resource; cancellation/disposal is reported through Void's existing
reject callback. Do not cache a resource outside its page or start another fetch.

SSR deliberately uses an inert pending Promise so Hono emits its initial
fallback immediately; never await this helper on the server. Void alone delivers
the later result to the browser. The adapter does not send Hono replacement HTML
or wait for deferred data in its server renderer. Only full Pages are supported;
deferred islands/static remain unsupported. Upstream failed-prefetch null values
remain null (the success value type includes null); this helper does not repair
that upstream limitation. This API shipped in RC.1; RC.0 does not include it.
