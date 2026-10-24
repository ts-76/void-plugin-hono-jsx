# RC security reassessment — 2026-10-17

## 2026-10-24 follow-up: Void 1.2.1 consumer and runner findings

**Decision: the previous esbuild-only acceptance does not cover the new findings. Keep the 0.7.0 release blocked.** This reassessment inspects merged Void 1.2.1 support source `c17aa72`, its committed locks, installed upstream source and small local response tests. It does not approve a new advisory set or claim authenticated production verification.

The fresh root audit reports **16 propagated package entries (High 6, Moderate 10, Critical 0), representing five distinct advisories**: the existing esbuild advisory and four new undici/Zod advisories. These counts describe this root report, not all possible consumer/bundle inventories. The publisher is a separate tree and is not counted here.

The previously prepared Void 1.2.1 support archive (still carrying version 0.6.0, not a 0.7.0 release) has SHA256 `4e448538f4132f014b7a0a232ab959130b7ab0cdfc399c9eba21505be63adf92`. Its 175 archive entries include no `node_modules` directory. The package build uses TypeScript emission rather than bundling upstream dependencies. This supports the archive boundary below; the final 0.7.0 archive must still be inspected afresh.

| Boundary | Observed inclusion/use | Decision and limits |
| --- | --- | --- |
| Adapter archive and source | Manifest has no direct undici/Zod dependency; runtime dependency is `@ts-76/hono-markdown`, with Void as a required peer. Inspected adapter source has no undici/Zod imports or EventSource calls. | No demonstrated new adapter request handler invoking those vulnerable APIs. This is **not** an unaffected-install claim: installing the required Void peer brings its tool dependencies. |
| Void/Cloudflare development, preview and CLI | `@cloudflare/workers-auth` 0.14.1 and `workers-utils` 0.47.3 pin undici 7.29.1. Miniflare 5 beta variants also pin it. Workers utilities call imported fetch for API/token/KV operations; Miniflare's `fetch` wrapper passes requests to `undici.fetch`. | The malformed-response DoS API is reachable in the toolchain. An attacker must control a contacted peer/response; anonymous access to an unrelated application route alone does not establish exploitability. Do not expose dev/preview services publicly or treat local-only use as a fix. |
| Browser navigation | Inspected Pages client uses browser fetch; Void SSE/live clients obtain the browser/global EventSource. | npm's Node undici is not thereby the browser implementation. No EventSource constructor call was observed in fixed publisher tests, and none is present in adapter source. Other Node consumers that explicitly use undici EventSource need their own review. |
| Config validation | `@cloudflare/config` 0.27.0 pins Zod 4.6.5. Its `resolveAndParseConfig` validates resolved project config with array schemas, including compatibility flags/domains/triggers. Miniflare and workers-utils also contain Zod 4.6.5 bundle markers, beyond the root audit's named package node. | Inspected config input is project configuration, not a demonstrated anonymous HTTP body. Narrow acceptance could cover trusted, bounded config only. It must not cover apps validating unbounded external data or every upstream command/bundled Zod use. A complete such reassessment is still required before acceptance. |
| Deployed applications | Worker-native fetch and application-defined validation are separate from the installed CLI dependency tree. | No production exploit was exercised. Inspect the selected deployment artifact, its external imports and actual handlers before asserting a particular deployed application is unaffected. Node SSR using Node 24.21.0 remains affected independently. |

The new advisory conditions and bounded local observations are:

- [EventSource memory exhaustion, GHSA-4qv8-2p9j-2685](https://github.com/advisories/GHSA-4qv8-2p9j-2685): a malicious SSE peer can grow parser state. Requires an affected EventSource connection; ordinary fetch or an SSE server response alone does not prove this path. No intentional OOM test was run.
- [SRI bypass, GHSA-f72v-6w45-q472](https://github.com/advisories/GHSA-f72v-6w45-q472): requires fetch integrity metadata using a mixed/uppercase algorithm. undici 7.29.1 accepted a local wrong body with `SHA256-...`, while lowercase `sha256-...` rejected it. The inspected adapter and Cloudflare caller paths do not set SRI metadata. Lowercase tokens are the upstream workaround; crypto hash checks outside fetch are not this mechanism.
- [Unhandled response error, GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c): a response with over five content codings plus an early close terminated a child using undici 7.29.1 **after** its catch handler ran. Separate undici 6.29.0 and Node 24.21.0 built-in fetch also exited 1. Catching fetch rejections, ordinary response-size checks and updating only the Node runtime are insufficient for separately installed/bundled undici. Fixed undici 7.30.1 and Node 24.22.1 built-in fetch survived and rejected the same response.
- [Zod memory exhaustion, GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5): validating 100/10,000 invalid array elements with installed Zod 4.6.5 created 100/10,000 issues. This demonstrates scaling, not an OOM or a remotely reachable application endpoint. A schema `.max(1)` still created per-element issues in the local probe; any interim bound must reject oversized input **before** passing it to affected validation. The fixed upstream version is 4.6.6.

### Required changes and release acceptance

1. **Implemented:** PR #136 raised the adapter/CI/release baseline to Node 24.22.1 and passed Linux publisher and consumer checks. This follow-up aligns the remaining local Node selector, contributor guide and active consumer/Cloudflare fixture engines with that minimum. Node 24.21.0's built-in undici 7.29.1 is outside npm's dependency audit inventory. The official [Node release](https://nodejs.org/en/blog/release/v24.22.1) includes undici 7.30.1 and other security fixes.
2. Prefer a Void/Cloudflare release whose complete resolved tree and distributed bundles use fixed undici/Zod. On this date Void latest is still 1.2.1; even newer config 0.28.0, workers-auth 0.15.0, workers-utils 0.48.0 and Miniflare 5.20261019.2-beta metadata still pin affected versions. Compatible updates did not remove the findings. Do not adopt the audit's suggested Void 0.20.3 downgrade or add transitive overrides.
3. EventSource/SRI and trusted config paths are **decision candidates**, not blanket acceptance. If upstream fixes lag, any exception needs exact versions, full bundled-copy coverage, advisory modified/content hashes, pre-validation/input/command bounds, enforcement and regression evidence. Reachable malformed-response handling must be resolved or explicitly risk-assessed as reachable; it cannot inherit the old esbuild non-use rationale. Current evidence does not justify changing `approvedDependencyAdvisories` or `dependencySecurityApproved` to accept the expanded set.
4. With those decisions implemented, refresh root/plain-Vite/aligned-Vite-Plus locks and audits, including ordinary and optional Markdown consumers. Re-run type/unit/source/browser tests and both complete consumers on identical tgz bytes. Recheck final release-PR head and merged main separately. No old green run or root-only audit substitutes for these gates.
5. **Publisher replacement implemented:** [PR #136 selected a fixed-dependency npm runtime](pnpm-publisher-assessment.md#current-publisher--2026-10-24) with a fresh zero-finding inventory audit. This does not approve the separate consumer findings above. Retain staging disabled until all release gates pass, then follow protected environment and npm-owner approval plus public artifact verification.

The reproducible response diagnostic is `node scripts/release/diagnose-consumer-response.mjs [absolute-undici-entry ...]`. Observations above were local macOS arm64 tests; fixed package archives were integrity-checked and the Node archive SHA256 matched the official release. They are not Linux publication evidence, full application security coverage or actual release receipts.

## Historical RC assessment

Issue #85's maintainer-approved policy selects the Void 1.1/Node 24 RC and conditional reassessment of known findings without overrides. This records the reassessment; alpha acceptance alone is not normal-release approval. New or changed advisories still stop upload.

## Source and evidence

PR #93 source `cabfecd` (GitHub tested merge `1ab9f83eecb869b506ab416e0f63b9fb94c3d6fc`) passed [Package and clean consumer](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/39010994804) and [Linux publisher validation](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/39010994851). The same accepted tarball SHA256 `6f7d9fefb968b7900479eef198086cc57e72d00a12d875f82e78d2f423b191c0` was verified by both supported consumers. This is a preparation artifact, not a public RC or a new stage receipt. The final release/tag must repeat fresh exact-head checks.

| Audit boundary | Rechecked result | RC acceptance scope |
| --- | --- | --- |
| Root, Void 1.1.11 / Hono 4.13.13 / Vite 8.3.4 | Moderate 5 propagated entries, High/Critical 0; one distinct advisory GHSA-67mh-4wv8-2f99 | The affected esbuild 0.18.20 serve feature is not used by the reviewed adapter/loader path. Preserve the existing no-serve restriction; do not generalize this to every upstream command |
| Plain Vite consumer, with and without optional Markdown parsers | Moderate 5 propagated entries, same single esbuild advisory | Exact locked consumer and documented adapter behavior; fresh report per candidate |
| Aligned Vite Plus/core 1.3.0 consumer, with and without parsers | Moderate 5 propagated entries, same single esbuild advisory | Exact aligned alias/lock; old Vite Plus 0.1.24/tinypool Critical findings are not accepted |
| pnpm 12.14.0 Linux x64 publisher | 517 crates; the same 7 exact accepted findings, with unchanged advisory contents | Pinned binary/source/inventory and fixed accepted tgz stage command only; isolated config/cache, no install/runtime download/server, mandatory OIDC/provenance |

CI artifacts contain the independent root/consumer/Markdown reports and report digests. Local root/ordinary/Markdown re-audits also returned only the same esbuild advisory. The official npm registry's latest-12 was 12.14.0 at reassessment; no newer pnpm 12 distribution was available to replace the affected ZIP dependency.

## Why conditional acceptance remains appropriate

The esbuild advisory affects its development server. The package compiles with TypeScript and transforms JSX with Vite/Oxc; the inspected upstream loader uses esbuild transforms. No serve caller was observed in this path. Consumers still install the affected upstream dependency, so the audit is nonzero. Do not add a transitive override, an unsupported Void downgrade or a blanket audit bypass. Reassess when the baseline, command, advisory or upstream fix changes.

The publisher still uses its exact reviewed tar/gzip stage path. Existing findings are anyhow/downcast_mut, proc-macro-error2's maintenance status, RSA private-key decryption, a custom-secret xxhash path, and three zip extraction APIs. The bounded source evaluation and Linux isolated native protocol checks apply to the unchanged publisher implementation. They do not prove all pnpm commands safe. Keep the exact finding ID/version/modified/content hashes and fresh inventory/API gates; the package archive does not ship pnpm or these crates. See [the detailed publisher assessment](pnpm-publisher-assessment.md).

On this evidence and the approved conditional policy, renew dependencySecurityApproved for this RC preparation without adding advisory IDs or changing publisher acceptance scope. This does not authorize a different tool version, target or stage command. The actual RC run still requires fresh source/root/consumer/publisher checks, same-run bytes, protected-environment review, owner approval and public verification.

## Runtime limitations are separate

At this 2026-10-17 reassessment, real Workers validation was still a normal-release gate. SSR DOM reuse, state-preserving HMR and production ISR remain outside the [release contract](release-contract.md). The 2026-10-18 result below records the completed direct Workers check without expanding those guarantees.

The dedicated D1 fixture also reproduced a local Miniflare/Vite transport failure when reusing a socket after an early oversized-body rejection. This resembles the historical undefined-action connection-reset limitation, but is a distinct observed trigger. Consuming the rejected response body did not prevent the local failure; using independent connections let the local dev and preview checks pass. Local negative HTTP assertions use those independent connections and must not be presented as a fix. Real HTTPS Worker checks retain normal connection pooling and must verify the rejection/follow-up path. Keep this in Issue #62 until the platform-specific behavior is assessed; the root cause and production impact remain unverified.

## 2026-10-18 follow-up: RC.1 and normal preparation

RC.1 stage/public verification retained the same one esbuild advisory (five propagated Moderate entries, High/Critical zero) and seven scoped Linux publisher findings. Its dedicated Worker fixture reported six propagated Moderate entries from the same advisory, not a new advisory. The [public and actual Worker records](releasing.md#rc1-publication-and-workers-evidence) distinguish artifact checks, runtime observations and cleanup.

The actual HTTPS fixture passed rejection/follow-up requests through a normal pool on both deployments without retries or Connection: close. This does not fix the local failure, identify its root cause or guarantee a single TCP socket/all platforms. The [limitations ledger](known-limitations.md) preserves that unresolved boundary, the upstream keyring-storage observation and triggers for renewed assessment.

The grouped 0.1.0 preparation changes documentation and Release Please selection, not peers, publisher pins, advisory IDs or accepted commands. It does not enlarge security acceptance or enable stage. Each final 0.1.0 candidate must produce fresh root/consumer/Markdown/publisher reports; new or changed unreviewed findings stop preparation/upload. Neither past RC acceptance nor a signature check means audit zero.
