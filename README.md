# void-plugin-hono-jsx

An experimental Hono JSX adapter for Void Pages. It renders pages with `hono/jsx` on the server and mounts them with `hono/jsx/dom` in the browser. Void owns route discovery, loaders, actions, navigation, head metadata and prerender collection.

Alpha versions are published on the `next` dist-tag under the [MIT license](LICENSE). Install `void-plugin-hono-jsx@next`; `latest` also points to the published `0.1.0-alpha.1` by maintainer decision, so an unqualified install currently selects an experimental alpha. The [release guide](docs/releasing.md#distribution-tag-cleanup) records the tag policy. The maintainer approved the release on npm after OIDC/provenance staging. See the [publication verification](docs/stage-validation-result.md). Repository manifests retain `private: true`; release preparation creates an isolated publishable candidate. This is not an official Void adapter.

## Compatibility

| Component | Accepted stable range | Full consumer fixtures |
| --- | --- | --- |
| Node.js | >=24.21.0 | 24.21.0 |
| Void | >=0.26.1 <0.28.0 or >=1.1.11 <1.2.0 | 0.26.1, 0.27.0, 1.1.11 |
| Hono | >=4.13.13 <5.0.0 | 4.13.13 |
| Vite | >=8.0.16 <9.0.0 | 8.0.16 (Vite Plus), 8.3.3, 8.3.4 |
| Vite Plus | Host Vite must satisfy the Vite range | 0.1.24 (historical scaffold), 1.1.0, 1.3.0 |
| TypeScript | Project tooling | 7.0.2 |

Published alpha.3 includes these peer ranges, running-Vite diagnostics and packaged source/maps. Alpha.1 and alpha.2 retain their exact-version gate. The unreleased preparation branch adds Void 1.1.11 and Vite Plus 1.3.0 (host Vite 8.3.4); published alpha.4 retains the earlier Void 0.x range. Stable Vite/Hono updates within the accepted ranges are admitted by compatibility policy; other Void minor lines require explicit validation. Prereleases are excluded. The original fixtures are the 2026-10-12 snapshot and the Void 1.1.11 fixtures are pinned on 2026-10-17; admitting a range does not mean every future version has already been tested. New upstream releases require refreshed fixtures, full checks and dependency audit review.

The expanded Link/Form APIs, island forms and graphs, deferred contracts, page options and optional Markdown documented below are additions after alpha.3. Use a later alpha containing the corresponding exports, or a local tarball to validate this source tree. Alpha.3 does not provide these additions.

## Install the alpha

Use Node 24.21.0 or newer in your project:

```sh
npm install void-plugin-hono-jsx@next hono@4.13.13
npm install --save-dev void@0.27.0 vite@8.3.4 typescript@7.0.2
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
npm install --save-dev void@0.27.0 vite@8.3.4 typescript@7.0.2
```

Configure the Vite plugins in `vite.config.ts`:

`voidHonoJsx()` and `HonoJsxOptions` replace the earlier `voidHonoPages()` and `HonoPagesOptions` names. This is a breaking alpha API change; the old names are not exported. Alpha.3 uses the earlier names. Use a local tarball or a release containing this rename for the configuration below.

```ts
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoJsx } from 'void-plugin-hono-jsx/plugin';

export default defineConfig({ plugins: [voidPlugin(), voidHonoJsx()] });
```

Use standard Vite scripts (`vite`, `vite build`, `vite preview`) or keep the scaffold's `vp dev`, `vp build`, `vp preview` scripts. The historical scaffold Vite Plus 0.1.24, 1.1.0 and current 1.3.0 are consumer fixtures. The gate checks the actual hook version and reports resolved package paths. See [launcher diagnostics](packages/hono-pages/README.md#running-vite-and-launcher-diagnostics).

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
- Local production-preview ISR through Void's KV/Cache API runtime.

Browser mounting redraws SSR content; it does not promise DOM reuse. Development reloads reset local state. Attributed imports inside interactive components, unknown island policies, deferred islands and static deferred output are unsupported. Void preserves resolved deferred values after actions until the next load/navigation. Failed deferred prefetch currently becomes a resolved `null` because Void does not transmit its error; use document/SPA streaming when error state is required. Grouped resolver projections require explicit prop types with the current Void `defer<T>` declaration. [ISR validation](docs/isr.md) covers the local direct-worker runtime. Managed deployment has not been verified.

The old scaffold Vite Plus has additional unapproved formatter advisories; prefer the current latest aligned toolchain or plain Vite. See [scaffold compatibility and audits](docs/scaffold-compatibility.md).

The initial alpha accepts one upstream esbuild advisory as a [known dependency limitation](docs/dependency-security.md), without overrides. Moderate findings across multiple package entries reflect that one advisory in the pinned Void/Drizzle dependency tree. Exact counts are recorded in each candidate's audit evidence. New unreviewed advisories still block the release plan; publisher tooling is assessed separately.

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

[Contribution guidance](CONTRIBUTING.md) explains local checks and bug reports. [Architecture](docs/architecture.md) describes the framework boundary and development renderer. [Release preparation](docs/releasing.md) explains exact-artifact verification, security gates and staged publishing. [Release checklist](docs/release-checklist.md) records remaining release decisions. [Third-party notices](THIRD_PARTY_NOTICES.md) document upstream adapter references and dependency licenses.

`voidHonoJsx()` retains its existing defaults (transitions disabled, 75ms hover delay, 30s cache). Opt in with `viewTransitions`, set `prefetch.hoverDelay` in milliseconds and `prefetch.cacheFor` using Void durations or a stale/expiry tuple. `<Link viewTransition={false}>` overrides the global transition setting; programmatic `router.visit(url, { viewTransition: true })` uses the same router. Native View Transitions fall back to normal navigation when the browser API is absent. The transition callback waits for Hono DOM commit and document-head synchronization. Hono integrates with Void's public navigation engine/facade and handles native animation skips separately from rendering failures ([View Transitions promise semantics](https://www.w3.org/TR/css-view-transitions-1/#viewtransition)).

Optional Markdown is available through `voidHonoMarkdown()` from `void-plugin-hono-jsx/markdown/plugin`, with `markdown-exit@1.3.0` and `yaml@2.9.1` installed explicitly. It supports document navigation, frontmatter/layouts, companion loaders, islands, page-specific scripts and static output. It is independent of the official `@void/md` compiler. See [setup and the supported Markdown contract](docs/markdown.md).
