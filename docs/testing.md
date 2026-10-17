# Testing and examples

Use the repository lockfile and Node.js 24.21.0. Source tests retain the original Void 0.26.1/Hono 4.13.13/Vite 8.3.3 baseline. Packed consumers additionally cover the Vite 8.3.4 patch, latest Void 0.27.0 with plain Vite 8.3.4, the standard scaffold's Vite Plus 0.1.24 (host Vite 8.0.16), and latest Vite Plus 1.1.0 (host Vite 8.3.3). Two further Hono-only fixtures use Void 1.1.11 with plain Vite 8.3.4 and aligned Vite Plus 1.3.0 (host Vite 8.3.4), pinned on 2026-10-17. All seven run dev, build, preview, browser interaction/reload, deferred data, islands, static output, compatibility diagnostics and local ISR. The existing required baseline context aggregates all seven results. Runtime Vite identity comes from the real config hook; npm Vite metadata is diagnostic only. The package guide distinguishes accepted stable ranges from individually tested versions.

Select a locked stack with `RELEASE_CONSUMER_STACK=baseline|vite-patch|latest-vite|scaffold-vp|latest-vp|void-1-vite|void-1-vp` when running `npm run check:consumer`. Fixtures for newer stacks overlay only package metadata/locks on the shared consumer source. Latest fixtures contain a snapshot of current registry versions, not floating installs; refresh them and run full checks/audit before declaring a new upstream release verified.

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
| `check:consumer` | Builds and packs the adapter, validates package contents/types, installs into an isolated locked consumer and tests development/preview interaction. Includes islands, deferred streaming, development reload races, host/peer range diagnostics, static output and local ISR. |

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

The Pages example is served at `http://127.0.0.1:5174/`. Its overview loader starts the counter at 7. In another terminal with the same environment settings, run `npm run build` and `npm run preview`; preview uses port 4174. Explicit `dev:pages`, `build:pages` and `preview:pages` aliases remain available.

The same example includes `/markdown`: authored Markdown with the shared app shell, frontmatter, a companion loader, a mobile menu and two independent Hono islands. Enter from the sidebar or overview; Markdown uses document navigation.

The original Custom SSR counter is available through `dev:custom-ssr`, `build:custom-ssr` and `preview:custom-ssr`, using development port 5173 and preview port 4173. Both examples resolve dependencies from the root installation. No cloud provisioning or deployment is needed for these local checks.

## Logs and verification records

Automated checks allocate temporary runtime/log directories and stop their own servers. Run checks sequentially when they share example build output. `KEEP_CONSUMER_FIXTURE=1` retains the packed fixture for diagnosis; remove it after inspection.

Generated logs, screenshots, runtime caches and tarballs are not committed. The former `evidence` logs and implementation/merge progress reports were removed from the current tree; their originals remain in Git history. Use CI run URLs and concise sanitized results in PRs/releases, and capture diagnostic artifacts separately when needed. Removing current files does not sanitize older commits; a full history review remains a release gate.

For publication, repeat validation on the final release commit and verify the actual npm artifact in a fresh consumer. Follow the [release checklist](release-checklist.md), including artifact checksums and post-publication verification. A local pack or dry run alone does not verify npm authentication, upload or registry behavior.

CI candidate artifact names include the stack: `npm-candidate-<sha>-<stack>-attempt-<attempt>`. Stage preparation uses the default baseline and keeps accepted artifact naming unchanged. `evidence.json.consumerStack` records the selected fixture, launcher, Void version, direct Vite version and expected host Vite. All required stack results must be reviewed before staging.
