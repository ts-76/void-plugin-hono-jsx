# Examples and testing

Use Node 24.22.1 and the repository lockfile.
Two active packed consumers cover Void 1.2.1 / Hono 4.13.13 with plain Vite 8.3.4 or aligned Vite Plus/core 1.3.0.
Select them with `RELEASE_CONSUMER_STACK=baseline` or `RELEASE_CONSUMER_STACK=void-1-vp`.

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

For installed Google Chrome, set `PLAYWRIGHT_CHANNEL=chrome` on browser commands.
Run checks sequentially when they share example build output.

| Check | Coverage |
| --- | --- |
| `typecheck` | Package source and both examples. |
| `test` | Discovery, virtual entries, providers and unsupported-mode diagnostics. |
| `audit:release` | Current files, accidental artifacts, configured credential/path patterns and license consistency. |
| `check:source` | Builds Pages; checks dev/preview HTTP contracts, SSR, navigation, forms, head and server-only bundle isolation. |
| `check:consumer` | Builds/packs the adapter and tests an isolated consumer in dev/preview. Includes forms, islands, deferred, Markdown, reloads, static output and local ISR. |

Consumer checks use the tarball, not repository imports.
Ordinary Pages are checked before optional Markdown peers are installed.
The Markdown consumer also installs pinned honoxpress 0.4.0 and copies its published UI templates. A separate fixture checks nested static components, TSX wrappers, explicit islands, metadata/catalog/TOC, document navigation, theme and CSS at 1280/390/320px in English/Japanese. Static pages are checked with JavaScript disabled and with network recording; runtime/SSG outputs are inspected for compiler leakage.
Local cache/control fixtures use synthetic state and are not deployment examples.

## Run an example manually

From the repository root:

```sh
mkdir -p .void/logs
export WRANGLER_LOG_PATH="$PWD/.void/logs"
export WRANGLER_SEND_METRICS=false
export VOID_INSPECTOR_PORT=false
export CLOUDFLARE_CF_FETCH_ENABLED=false
npm run dev
```

| Example | Commands | Ports |
| --- | --- | --- |
| Pages, including `/markdown` | `dev`, `build`, `preview` | 5174 / 4174 |
| Minimal Custom SSR counter | `dev:custom-ssr`, `build:custom-ssr`, `preview:custom-ssr` | 5173 / 4173 |

Build before starting preview. These examples need no cloud provisioning.

## Logs and CI artifacts

Automated checks allocate temporary directories and stop their own servers.
`KEEP_CONSUMER_FIXTURE=1` retains the consumer for debugging; remove it afterward.
Keep logs, screenshots, caches and tarballs out of Git. Include concise sanitized results and CI links in PRs.

The [package workflow](../.github/workflows/package.yml) runs source checks and prepares one archive with consumer acceptance pending.
Plain Vite and Vite Plus jobs download the same bytes and run in parallel. Each
checks source/run/attempt/digests, runs its own full consumer and fresh audit,
then marks its own evidence accepted. Pending evidence cannot pass release
inspection or planning. Both stacks are required before the stable required
status succeeds.

Only PRs changing prose `.md` files exclusively under `docs/` skip packed browser
consumers. Dependency-security and release-procedure docs still require full
checks; packaged README, changelogs, fixtures, code and unknown paths do too.
Main pushes and manual runs always use full validation. A failed scope check or
missing/cancelled consumer result fails the required status.
Publisher checks run on PRs and main rather than also duplicating feature pushes;
stale validation runs on the same branch are cancelled. The independent common
package workflow retains its package and workerd checks.

Artifacts use `npm-candidate-<sha>-<stack>-attempt-<attempt>` names.
`evidence.json.consumerStack` identifies the fixture, launcher and expected host.
The stage workflow performs fresh preparation in its own run; it does not reuse a package-workflow candidate.
See [releasing](releasing.md) for artifact retention and public verification.

## Other verification

- [Workers/D1 exercise](cloudflare-rc1-verification.md): real RC.1 deployment, migrations, redeployment and cleanup. ISR was checked separately; managed Void remains unverified.
- [ISR Workers exercise](isr-cloudflare-verification.md): public 0.2.0 with dedicated D1/KV; includes a failing query-purge check and explicit propagation limits. This is a manual operational test, not a CI deployment.
- [Hono Transition experiment](hono-transition-evaluation.md): diagnostic comparison, not a release gate or performance benchmark.
- [Baseline update procedure](known-limitations.md#updating-the-supported-baseline): framework upgrades and fresh audits.

Local rejected-POST checks isolate connections because of an [unresolved transport issue](known-limitations.md#local-rejected-post-connection-issue).
The workaround does not establish an adapter fix.
