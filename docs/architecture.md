# Adapter architecture

The adapter targets stable Void `>=0.26.1 <0.28.0`, Hono `>=4.13.13 <5.0.0` and Vite `>=8.0.16 <9.0.0` (five locked consumers cover the original baseline, scaffold and current latest). It is experimental and is not an official Void adapter. User-facing APIs, supported modes and limitations are documented in the [package guide](../packages/hono-pages/README.md).

## Package source and outputs

All adapter source lives under `packages/hono-pages/src`:

| Source | Responsibility |
| --- | --- |
| `plugins/hono-pages.ts` | Void page discovery, component manifests, virtual renderer/client entries and reload invalidation. |
| `plugins/hono-jsx.ts` | Environment-aware Oxc JSX transformation for Hono server and DOM factories. |
| `plugins/hono-islands.ts` | Supported load-policy imports, island markers and unsupported-mode diagnostics. |
| `plugins/compatibility.ts` | Exact framework version checks and actionable install diagnostics. |
| `plugins/runtime-paths.ts` | Runtime locations for the source example; replaced with compiled entry locations by the package build. |
| `runtime/pages.tsx` and `runtime/form.ts` | Shared providers, navigation/hooks and action forms. |
| `runtime/client.tsx`, `runtime/deferred.ts` and `runtime/document-head.ts` | Browser mounting, deferred updates and document synchronization. |

`npm run build:package` compiles package-local TypeScript configurations into `dist/plugins`, `dist/server` and `dist/browser`. The build rewrites provider imports to the public package identity so providers and hooks share the same module instance. The Vite plugin selects server or browser runtime paths using Vite's consumer environment; a browser export condition alone cannot distinguish Cloudflare worker rendering from DOM rendering.

The package's `files` allowlist includes `dist` (JavaScript, declarations and both maps), original `src`, `README.md`, `CHANGELOG.md`, `LICENSE` and `THIRD_PARTY_NOTICES.md`. All map sources must resolve within packaged `src`; JS maps embed identical source contents. Source bytes must match the reviewed checkout. Examples, fixtures, build configurations, tests and development logs belong to the repository and are not npm payload. The packed-consumer check enforces this boundary and rejects machine-specific paths.

## Void integration boundary

Void owns routes, request handling, loaders/actions, navigation protocols, head resolution, deferred transport, prerender discovery and cache behavior. The adapter supplies Hono rendering and browser state integration rather than implementing a second router or cache.

| Interface | Use |
| --- | --- |
| `void/pages` | Page directory resolution, scanning and component manifest generation at build time. |
| `void/pages-protocol` | `PageObject` payload types. |
| `void/pages-server` | Safe initial page-data serialization. |
| `void/pages-head` | SSR metadata and document-attribute rendering. |
| `void/pages-client` | Shared routing, actions, deferred registry and browser lifecycle. |
| `virtual:void-pages-renderer`, `virtual:void-pages-client`, `pages-client` | Version-specific entry conventions adapted from the published official `@void/react` adapter. |
| `__VOID_PAGE_DATA__` and `#app` | Initial JSON payload and mount-element conventions. |

Exported framework APIs and version-specific virtual entry conventions have different stability guarantees. The latter are not a documented third-party registration API. Exact peers are intentional; widening them requires clean-consumer runtime validation. [Third-party notices](../THIRD_PARTY_NOTICES.md) preserve upstream attribution.

## Provider identity and development reloads

Development SSR eagerly captures server-rendered page and layout modules with their renderer and providers. Without that snapshot, an in-flight old renderer could lazily import a page from a newer worker module generation and return HTTP 500. Browser-only page modules stay out of the server graph. Production retains lazy page imports.

This means server-side page initialization happens when the development renderer loads, including pages not yet visited. Invalidations are limited to changed modules and Pages virtual entries; Void owns structural worker reloads. Page and loader edits reload the document and reset local state. The regression sends parallel SSR requests during six simultaneous page/loader revisions and requires every response to succeed.

## Browser and output boundaries

Browser mounting redraws SSR content; DOM reuse and state-preserving HMR are not promised. Surviving layout state and refreshed page state follow the shared Void router. Deferred completion updates are tied to the rendered props object, and an initial queue buffers completions while components load.

Static output uses Void's generated HTML and Pages JSON with a file-only server. Actions require a server. Deferred static routes fail rendering; the pinned Void version may continue the build and omit those routes, so expected output files are checked explicitly.

Load-policy islands mount interactive components only. Static-only island pages emit no executable client scripts. Unsupported policies, island layouts, nested attributed imports and island form helpers fail with diagnostics. Local ISR uses Void's own KV/Cache API worker path; see [ISR validation](isr.md) for observed behavior and unverified managed-edge scope.

The original Custom SSR proof of concept remains in `examples/custom-ssr`: `defineRender` creates Hono HTML, Void supplies asset tags, and a browser entry redraws a counter. It exercises the shared JSX transform without depending on the Pages renderer.
