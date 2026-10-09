# void-plugin-hono-jsx

An experimental Hono JSX adapter for Void Pages. It renders pages with `hono/jsx` on the server and mounts them with `hono/jsx/dom` in the browser. Void owns route discovery, loaders, actions, navigation, head metadata and prerender collection.

The package is private and unpublished. Maintainers selected `void-plugin-hono-jsx` as its name; the project license is pending. This is not an official Void adapter. Publication and repository visibility require separate maintainer decisions.

## Compatibility

| Component | Verified baseline |
| --- | --- |
| Node.js | 24.21.0 |
| Void | 0.26.0 |
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
npm install ./void-plugin-hono-jsx-0.0.0.tgz hono@4.13.13
npm install --save-dev void@0.26.0 vite@8.3.3 typescript@7.0.2
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

## Examples and checks

`examples/pages` demonstrates the source adapter. `fixtures/consumer` uses only packaged exports. `fixtures/static` demonstrates generated HTML and JSON served without a worker. The original Custom SSR demonstration is available through `npm run dev` and `npm run build`.

```sh
npm run typecheck
npm test
npm run check:consumer
```

The consumer check installs the packed artifact in a temporary project and exercises development, production preview, islands, deferred data, static output and local ISR in a browser. Install Playwright Chromium first with `npx playwright install chromium`, or set `PLAYWRIGHT_CHANNEL=chrome` to use installed Google Chrome. The prepared workflow has not been activated; CI results remain pending.

[Contribution guidance](CONTRIBUTING.md) explains local checks and bug reports. [Implementation notes](docs/implementation-notes.md) preserve the original PoC record and detailed feature checks. [Release checklist](docs/release-checklist.md) records remaining release decisions. [Third-party notices](THIRD_PARTY_NOTICES.md) document upstream adapter references and dependency licenses.
