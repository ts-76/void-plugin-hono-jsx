# RC security reassessment — 2026-10-17

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

SSR DOM reuse, state-preserving HMR and production ISR remain outside the [release contract](release-contract.md). Real Workers validation is still a normal-release gate.

The dedicated D1 fixture also reproduced a local Miniflare/Vite transport failure when reusing a socket after an early oversized-body rejection. This resembles the historical undefined-action connection-reset limitation, but is a distinct observed trigger. Consuming the rejected response body did not prevent the local failure; using independent connections let the local dev and preview checks pass. Local negative HTTP assertions use those independent connections and must not be presented as a fix. Real HTTPS Worker checks retain normal connection pooling and must verify the rejection/follow-up path. Keep this in Issue #62 until the platform-specific behavior is assessed; the root cause and production impact remain unverified.
