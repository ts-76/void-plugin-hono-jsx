# Testing and examples

Use the repository lockfile and Node 24.21.0. Root/source and the baseline packed consumer now use Void 1.1.11/Hono 4.13.13/plain Vite 8.3.4. The other required consumer uses Vite Plus/core 1.3.0 (host Vite 8.3.4). Both Hono-only configurations run complete dev/build/preview/browser, forms including multipart, deferred, islands, Markdown, static output, host diagnostics and local ISR regression checks. Production ISR is outside the initial guarantee.

Select `RELEASE_CONSUMER_STACK=baseline|void-1-vp`. Metadata/locks from `consumer-void-1-vite` or `consumer-void-1-vp` overlay shared source in `fixtures/consumer`. Historical Void 0.x/scaffold manifests remain intact but cannot select a current release stack; real packed checks verify that old Void versions are rejected. Accepted ranges do not certify untested future versions.

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

For installed Google Chrome, set `PLAYWRIGHT_CHANNEL=chrome` for the browser check commands. CI installs Chromium with system dependencies and runs the [package workflow](../.github/workflows/package.yml) on pull requests, main/release-branch pushes and manual dispatches. Feature branches use the PR run rather than duplicating the package workflow on each push. A successful run must match the commit being reviewed; earlier reports are historical evidence.

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

The package workflow runs common source/history/secret/type/unit/browser checks, build, pack and dry run once in the baseline job. The other supported stack downloads that job's accepted tarball and run `release:verify-consumer`. It verifies the originating workflow/run/attempt, source and hashes before executing the consumer, requires a new per-stack audit, then rechecks the bytes and evidence. Both supported stacks remain required.

CI candidate artifact names include the stack: `npm-candidate-<sha>-<stack>-attempt-<attempt>`. Stage preparation still runs the complete `release:prepare` in its own run and keeps accepted artifact naming unchanged; it never consumes a package-workflow candidate. `evidence.json.consumerStack` records the selected fixture, launcher, Void version, direct Vite version and expected host Vite. All required stack results must be reviewed before staging.

## Hono Transition diagnostic experiment

[The #98 evaluation](hono-transition-evaluation.md) compares the existing frame
update with Hono `startTransition` and `useTransition` in an isolated copy of a
retained baseline consumer. It records state/commit behavior in dev and preview;
it is not an artifact acceptance gate or a performance benchmark. No production
Transition option is enabled by this experiment.

## Actual Cloudflare RC.1 verification

The [2026-10-18 Workers/D1 record](cloudflare-rc1-verification.md) covers the public RC.1 package, actual HTTPS/browser checks, two migrations, redeployment with retained data, and verified deletion after maintainer inspection. It does not extend the production ISR or managed-platform guarantee.

For upstream upgrades, follow the [baseline refresh and re-evaluation procedure](known-limitations.md#updating-the-supported-baseline). Local rejection/follow-up tests use isolated connections because of an unresolved transport limitation; actual HTTPS used normal pooling. Test workarounds do not establish an adapter fix or a production guarantee.
