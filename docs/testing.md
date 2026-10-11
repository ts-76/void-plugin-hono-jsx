# Testing and examples

Use the repository lockfile and Node.js 24.21.0. The verified framework baseline is Void 0.26.1, Hono 4.13.13, Vite 8.3.3 and TypeScript 7.0.2. Other framework versions are rejected by the plugin and are not claimed as supported.

## Automated checks

```sh
npm ci
npm run typecheck
npm test
npm run audit:release
npm run build:custom-ssr
npx playwright install chromium
npm run check:source
npm run check:consumer
```

For installed Google Chrome, set `PLAYWRIGHT_CHANNEL=chrome` for the browser check commands. CI installs Chromium with system dependencies and runs the [package workflow](../.github/workflows/package.yml) on pushes and pull requests. A successful run must match the commit being reviewed; earlier reports are historical evidence.

| Check | Coverage |
| --- | --- |
| `typecheck` | Package source and both examples. |
| `test` | Discovery, virtual entries, provider snapshots, server-only components and unsupported-mode diagnostics. |
| `audit:release` | Current tracked/proposed files, accidental artifacts, configured path/credential patterns and matching license/notices. Does not scan Git history or certify every secret. |
| `build:custom-ssr` | Minimal Custom SSR counter production build. |
| `check:source` | Pages production build; development/preview HTTP contracts, safe JSON, routes/client-only shells, SSR layouts/head, action methods/failures/redirects and server-only bundle isolation; browser navigation/history/native links, layout persistence, forms and head synchronization. |
| `check:consumer` | Builds and packs the adapter, validates package contents/types, installs into an isolated locked consumer and tests development/preview interaction. Includes islands, deferred streaming, development reload races, exact-peer diagnostics, static output and local ISR. |

The source check combines HTTP and browser regressions in one owned-server runner. `scripts/check-source-contracts.mjs` provides the HTTP/SSR checks. The former manual Pages scripts have been consolidated; Python, agent-browser and pre-started Chrome sessions are no longer required.

The consumer's deferred gates and ISR control API use synthetic state for deterministic checks. They are not deployment examples. `fixtures/static` verifies file-only output, and `fixtures/isr` verifies the local direct-worker cache path. Managed deployment, production KV propagation and cross-data-center behavior remain unverified.

## Run an example manually

From the repository root, set local runtime options:

```sh
mkdir -p .void/logs
export WRANGLER_LOG_PATH="$PWD/.void/logs"
export WRANGLER_SEND_METRICS=false
export VOID_INSPECTOR_PORT=false
export CLOUDFLARE_CF_FETCH_ENABLED=false
npm run dev
```

The Pages example is served at `http://127.0.0.1:5174/`. Its loader starts the counter at 7. In another terminal with the same environment settings, run `npm run build` and `npm run preview`; preview uses port 4174. Explicit `dev:pages`, `build:pages` and `preview:pages` aliases remain available.

The original Custom SSR counter is available through `dev:custom-ssr`, `build:custom-ssr` and `preview:custom-ssr`, using development port 5173 and preview port 4173. Both examples resolve dependencies from the root installation. No cloud provisioning or deployment is needed for these local checks.

## Logs and verification records

Automated checks allocate temporary runtime/log directories and stop their own servers. Run checks sequentially when they share example build output. `KEEP_CONSUMER_FIXTURE=1` retains the packed fixture for diagnosis; remove it after inspection.

Generated logs, screenshots, runtime caches and tarballs are not committed. The former `evidence` logs and implementation/merge progress reports were removed from the current tree; their originals remain in Git history. Use CI run URLs and concise sanitized results in PRs/releases, and capture diagnostic artifacts separately when needed. Removing current files does not sanitize older commits; a full history review remains a release gate.

For publication, repeat validation on the final release commit and verify the actual npm artifact in a fresh consumer. Follow the [release checklist](release-checklist.md), including artifact checksums and post-publication verification. A local pack or dry run alone does not verify npm authentication, upload or registry behavior.
