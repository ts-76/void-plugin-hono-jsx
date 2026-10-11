# void-plugin-hono-jsx

An experimental Hono JSX adapter for Void Pages. It renders pages with `hono/jsx` on the server and mounts them with `hono/jsx/dom` in the browser. Void owns route discovery, loaders, actions, navigation, head metadata and prerender collection.

The package is unpublished. The initial candidate is `0.1.0-alpha.0` on the `next` dist-tag. Package manifests retain `private: true`; release preparation creates an isolated publishable candidate. The source repository is public. Maintainers selected `void-plugin-hono-jsx` as its name and the [MIT license](LICENSE) for the project. This is not an official Void adapter. npm publication requires a separate maintainer decision.

## Compatibility

| Component | Verified baseline |
| --- | --- |
| Node.js | 24.21.0 |
| Void | 0.26.1 |
| Hono | 4.13.13 |
| Vite | 8.3.3 |
| TypeScript | 7.0.2 |

Node.js must be at least 24.21.0. The adapter requires the exact framework versions above and rejects other versions with an install command. Its virtual renderer and client entries follow version-specific conventions in Void's official adapter. A local successful check does not establish upstream support or compatibility with newer releases.

## Try the package locally

Use the checked-in lockfile and supported Node version:

```sh
npm ci
npm run build:package
npm pack ./packages/hono-pages
```

In a separate project, install the resulting tarball:

```sh
npm install ./void-plugin-hono-jsx-0.1.0-alpha.0.tgz hono@4.13.13
npm install --save-dev void@0.26.1 vite@8.3.3 typescript@7.0.2
```

Configure the Vite plugins in `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoPages } from 'void-plugin-hono-jsx/plugin';

export default defineConfig({ plugins: [voidPlugin(), voidHonoPages()] });
```

Keep project settings in `void.config.ts`, using `defineConfig` from `void/config`. These files have different roles. Run Vite from your project root. The adapter includes JSX transformation; set TypeScript's `jsx` to `react-jsx` and `jsxImportSource` to `hono/jsx`.

See the [package guide](packages/hono-pages/README.md) for public exports, configuration and examples.

## Supported behavior

- Loader-backed SSR, file-based routes and client-only pages.
- Void navigation, root/nested/named layouts and action forms.
- Resolved head metadata, document attributes and inert navigation scripts.
- Single deferred loader props on GET document requests and SPA navigation.
- Load-policy Hono islands and zero-script static island pages.
- Static HTML/page-data output and declared dynamic prerender paths.
- Development document reloads for page/loader edits and route additions/removals.
- Local production-preview ISR through Void's KV/Cache API runtime.

Browser mounting redraws SSR content; it does not promise DOM reuse. Development reloads reset local state. Island layouts, other island policies, grouped deferred props, deferred prefetch and mutation-driven deferred refresh are unsupported. [ISR validation](docs/isr.md) covers the local direct-worker runtime. Managed deployment has not been verified.

The initial alpha accepts one upstream esbuild advisory as a [known dependency limitation](docs/dependency-security.md), without overrides. Moderate findings across multiple package entries reflect that one advisory in the pinned Void/Drizzle dependency tree. Exact counts are recorded in each candidate's audit evidence. New unreviewed advisories still block the release plan; publisher tooling is assessed separately.

## Examples and checks

The repository separates the publishable adapter, runnable examples and automated fixtures:

| Directory | Purpose |
| --- | --- |
| `packages/hono-pages` | Package metadata, user guide, adapter source and build configuration. Only `dist`, the guide, changelog and license/notices are packed. |
| `examples/pages` | Full Pages example using the adapter source, including navigation, layouts, forms and head metadata. |
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
