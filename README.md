# void-plugin-hono-jsx

A Hono JSX adapter for Void Pages. It renders pages with `hono/jsx` on the server and mounts them with `hono/jsx/dom` in the browser. Void owns route discovery, loaders, actions, navigation, head metadata and prerender collection.

The normal 0.1.x series is published under the [MIT license](LICENSE). Install the default package below; `latest` selects the publicly verified normal release. `next` selects the most recently approved candidate and may point to a prerelease during later release cycles. Normal releases are promoted only after public artifact/consumer verification. See the [release contract](docs/release-contract.md) and [dated publication record](docs/releasing.md#010-publication-and-tag-verification). Source manifests stay `private: true`; preparation creates an isolated publishable candidate. This is not an official Void adapter.

## Compatibility

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

## Install the normal release

Use Node 24.21.0 or newer within Node 24 in your project. The unqualified package selects `latest`; use `void-plugin-hono-jsx@0.1.0` to reproduce the first normal release. Use `@next` only when deliberately testing the currently approved candidate:

```sh
npm install void-plugin-hono-jsx hono@4.13.13
npm install --save-dev void@1.1.11 vite@8.3.4 typescript@7.0.2
```

For a local source build, use the checked-in lockfile and supported Node version:

```sh
npm ci
npm run build:package
npm pack ./packages/hono-pages
```

In a separate project, install the resulting tarball:

```sh
npm install ./void-plugin-hono-jsx-<version>.tgz hono@4.13.13
npm install --save-dev void@1.1.11 vite@8.3.4 typescript@7.0.2
```

The local tarball commands are for source verification; they do not publish a version. See the [approved release contract](docs/release-contract.md) for support, multipart, security and production gates.

Configure the Vite plugins in `vite.config.ts`:

`voidHonoJsx()` and `HonoJsxOptions` replace the earlier `voidHonoPages()` and `HonoPagesOptions` names. This is a breaking alpha API change; the old names are not exported. Alpha.3 uses the earlier names; the normal 0.1.x series exports the new names shown below.

```ts
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoJsx } from 'void-plugin-hono-jsx/plugin';

export default defineConfig({ plugins: [voidPlugin(), voidHonoJsx()] });
```

Use standard Vite scripts (`vite`, `vite build`, `vite preview`) or keep the scaffold's `vp dev`, `vp build`, `vp preview` scripts. The supported Vite Plus fixture is 1.3.0 with its matching core alias. Old launchers are outside the current support policy. The gate checks the actual hook version and reports resolved package paths. See [launcher diagnostics](packages/hono-pages/README.md#running-vite-and-launcher-diagnostics).

Keep project settings in `void.config.ts`, using `defineConfig` from `void/config`. These files have different roles. Run Vite from your project root. The adapter includes JSX transformation; set TypeScript's `jsx` to `react-jsx` and `jsxImportSource` to `hono/jsx`.

See the [package guide](packages/hono-pages/README.md) for public exports, configuration and examples.

## Supported behavior

- Loader-backed SSR, file-based routes and client-only pages.
- Void navigation, root/nested/named layouts and action forms.
- Resolved head metadata, document attributes and inert navigation scripts.
- Single and grouped deferred loader props on GET document/SPA requests, successful prefetch→visit, and resolved-value retention after actions.
- Load/visible/idle/media Hono islands and zero-script static island pages.
- Static HTML/page-data output and declared dynamic prerender paths.
- Development document reloads for page/loader edits and route additions/removals.
- Local ISR regression checks through Void's KV/Cache API runtime; production ISR is outside the initial guarantee.

Browser mounting redraws SSR content; it does not promise DOM reuse. Development reloads reset local state. Attributed imports inside interactive components, unknown island policies, deferred islands and static deferred output are unsupported. Void preserves resolved deferred values after actions until the next load/navigation. Failed deferred prefetch currently becomes a resolved `null` because Void does not transmit its error; use document/SPA streaming when error state is required. Grouped resolver projections require explicit prop types with the current Void `defer<T>` declaration. [ISR validation](docs/isr.md) covers the local direct-worker runtime. Direct Cloudflare Workers/D1 deployment, migration, redeployment and cleanup were [verified with RC.1](docs/cloudflare-rc1-verification.md). The managed Void platform and production ISR remain unverified. See the [limitations ledger](docs/known-limitations.md) for conditions and re-evaluation triggers.

The old scaffold Vite Plus has additional unapproved formatter advisories; use the tested aligned Vite Plus 1.3.0 or plain Vite 8.3.4. See [scaffold compatibility and audits](docs/scaffold-compatibility.md).

The [RC security reassessment](docs/rc-security-assessment.md) retains one upstream esbuild advisory as a known dependency limitation under the reviewed conditions, without overrides. Moderate findings across multiple package entries reflect that one advisory in the pinned Void/Drizzle dependency tree. Exact counts are recorded in each candidate's audit evidence. New unreviewed advisories still block the release plan; publisher tooling is assessed separately.

## Examples and checks

The repository separates the publishable adapter, runnable examples and automated fixtures:

| Directory | Purpose |
| --- | --- |
| `packages/hono-pages` | Package metadata, user guide, adapter source and build configuration. Only `dist`, `src`, the guide, changelog and license/notices are packed. |
| `examples/pages` | Pages and Markdown example using the adapter source, including navigation, layouts, forms, head metadata and independent Hono islands. |
| `examples/custom-ssr` | Original minimal Custom SSR counter, kept as a separate example. |
| `fixtures` | Isolated packed-consumer, static-output and local ISR test inputs. |
| `scripts` and `tests` | Build, release-content audit and automated behavioral checks. |
| `docs` | Architecture, testing, local ISR and release guidance. |

`npm run dev`, `npm run build` and `npm run preview` now run the Pages example. The explicit `dev:pages`, `build:pages` and `preview:pages` commands also remain available. Use `dev:custom-ssr`, `build:custom-ssr` and `preview:custom-ssr` for the minimal example. See [testing guidance](docs/testing.md) for local environment settings and check coverage.

```sh
npm run typecheck
npm test
npm run check:consumer
npm run check:source
```

The consumer check installs the packed artifact in a temporary project and exercises development, production preview, islands, deferred data, static output and local ISR in a browser. The source check starts its own servers and covers HTTP contracts, server-only bundle isolation and Pages browser behavior. Install Playwright Chromium first with `npx playwright install chromium`, or set `PLAYWRIGHT_CHANNEL=chrome` to use installed Google Chrome. The [package workflow](.github/workflows/package.yml) runs on pushes and pull requests with Node 24.21.0. It checks types, adapter tests, release content, both example builds and the packed browser consumer. Check the actual GitHub Actions result for the commit being reviewed; enabling the workflow alone does not establish a passing result.

[Stable release roadmap](docs/stable-roadmap.md) records the approved support boundaries and remaining release gates. [Alpha.4 source review](docs/source-review-alpha4.md) records measured duplication and the recommended implementation order. The roadmap records the completed 0.1.0 publication and follow-up work; the source review remains the dated 2026-10-17 investigation.

[Contribution guidance](CONTRIBUTING.md) explains local checks and bug reports. [Architecture](docs/architecture.md) describes the framework boundary and development renderer. [Release preparation](docs/releasing.md) explains exact-artifact verification, security gates and staged publishing. [Release checklist](docs/release-checklist.md) lists the checks to repeat for each candidate. [Third-party notices](THIRD_PARTY_NOTICES.md) document upstream adapter references and dependency licenses.

`voidHonoJsx()` retains its existing defaults (transitions disabled, 75ms hover delay, 30s cache). Opt in with `viewTransitions`, set `prefetch.hoverDelay` in milliseconds and `prefetch.cacheFor` using Void durations or a stale/expiry tuple. `<Link viewTransition={false}>` overrides the global transition setting; programmatic `router.visit(url, { viewTransition: true })` uses the same router. Native View Transitions fall back to normal navigation when the browser API is absent. The transition callback waits for Hono DOM commit and document-head synchronization. Hono integrates with Void's public navigation engine/facade and handles native animation skips separately from rendering failures ([View Transitions promise semantics](https://www.w3.org/TR/css-view-transitions-1/#viewtransition)).

Optional Markdown is available through `voidHonoMarkdown()` from `void-plugin-hono-jsx/markdown/plugin`, with `markdown-exit@1.3.0` and `yaml@2.9.1` installed explicitly. It supports document navigation, frontmatter/layouts, companion loaders, islands, page-specific scripts and static output. It is independent of the official `@void/md` compiler. See [setup and the supported Markdown contract](docs/markdown.md).

Security reports use [private vulnerability reporting](https://github.com/ts-76/void-plugin-hono-jsx/security/advisories/new). See [SECURITY.md](SECURITY.md) for support windows.


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
