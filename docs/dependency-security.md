# Dependency advisory acceptance

## 0.9.0 owner acceptance — 2026-10-25

The owner explicitly accepted the remaining Void/Cloudflare tooling risks for **void-plugin-hono-jsx 0.9.0 only** after reassessment. This is a new, version-specific decision; it does not extend the earlier 0.8.0 approval to arbitrary releases. The latest root, ordinary-consumer and Markdown-consumer audits retain 16 propagated entries (High 6, Moderate 10, Critical 0), representing the existing esbuild advisory and the same four undici/Zod advisories described below. Upstream Void's latest release remains 1.2.1. These dependencies are not repaired by this acceptance.

- A malformed response from a contacted peer can terminate Node development/CLI tooling through affected undici, even when fetch rejection is caught (GHSA-xjj6-f33q-929c).
- The affected EventSource parser can exhaust memory (GHSA-4qv8-2p9j-2685). No EventSource call was observed in the adapter path; arbitrary application use is outside this assessment.
- Mixed-case SRI tokens can bypass affected undici's integrity checks (GHSA-f72v-6w45-q472). Inspected toolchain callers do not set SRI; applications relying on it need a fixed implementation.
- Oversized invalid input can make affected Zod allocate excessive validation issues (GHSA-mrhx-c7xc-m3w5). Reviewed toolchain input is project configuration; anonymous application endpoints were not proven vulnerable.

Use trusted project configuration, keep dev/preview interfaces private, bound external input before validation, and avoid adding untrusted remote peers or affected EventSource/SRI paths. Do not use the affected esbuild version's own serve feature. These are usage limits rather than code fixes or a guarantee for every upstream command. Worker-native fetch and application-defined handlers require their own assessment. The independent Markdown 0.2.0 article consumer has a separate dependency graph and passed its minimal/full-peer audits with zero findings; that does not remove the Void toolchain findings.

`consumerRiskAcceptance` is restricted to 0.9.0, Node 24.22.1, Void `>=1.2.1 <1.3.0`, the three recorded lockfile hashes, and the four exact OSV advisory records. The root lock differs from the reviewed 0.8.0 lock only in its two adapter release-version fields and linked common-package version metadata; third-party dependency records and both fixture locks are unchanged. Its hash is renewed for 0.9.0. The adapter now requires the separately published common runtime `^0.2.0`. Root and both locked ordinary/Markdown consumer audits, exact-artifact checks and fresh advisory validation remain mandatory. Changed dependencies, peers, Node, advisory records, any additional finding or a later release require reassessment. The separately fixed npm publisher keeps its zero-finding gate. No dependency override, forced transitive upgrade or automatic waiver is added.

The earlier decisions below are historical records. Prefer a compatible upstream fixed release, then remove this exception after complete lock/bundle and real-consumer verification.

## 0.8.0 owner acceptance — 2026-10-25

The owner explicitly accepted the remaining Void/Cloudflare tooling risks for **void-plugin-hono-jsx 0.8.0 only** after reassessment. This is a new, version-specific decision; it does not extend the earlier 0.7.0 approval to arbitrary releases. The latest root, ordinary-consumer and Markdown-consumer audits retain 16 propagated entries (High 6, Moderate 10, Critical 0), representing the existing esbuild advisory and the same four undici/Zod advisories described below. Upstream Void's latest release remains 1.2.1. These dependencies are not repaired by this acceptance.

- A malformed response from a contacted peer can terminate Node development/CLI tooling through affected undici, even when fetch rejection is caught (GHSA-xjj6-f33q-929c).
- The affected EventSource parser can exhaust memory (GHSA-4qv8-2p9j-2685). No EventSource call was observed in the adapter path; arbitrary application use is outside this assessment.
- Mixed-case SRI tokens can bypass affected undici's integrity checks (GHSA-f72v-6w45-q472). Inspected toolchain callers do not set SRI; applications relying on it need a fixed implementation.
- Oversized invalid input can make affected Zod allocate excessive validation issues (GHSA-mrhx-c7xc-m3w5). Reviewed toolchain input is project configuration; anonymous application endpoints were not proven vulnerable.

Use trusted project configuration, keep dev/preview interfaces private, bound external input before validation, and avoid adding untrusted remote peers or affected EventSource/SRI paths. Do not use the affected esbuild version's own serve feature. These are usage limits rather than code fixes or a guarantee for every upstream command. Worker-native fetch and application-defined handlers require their own assessment. The independent Markdown 0.1.2 article consumer has a separate dependency graph and passed its minimal/full-peer audits with zero findings; that does not remove the Void toolchain findings.

`consumerRiskAcceptance` is restricted to 0.8.0, Node 24.22.1, Void `>=1.2.1 <1.3.0`, the three recorded lockfile hashes, and the four exact OSV advisory records. The root lock differs from the reviewed 0.7.0 lock only in its two release-version fields; its hash is renewed for 0.8.0. The adapter now requires the separately published common runtime `^0.1.2`. Root and both locked ordinary/Markdown consumer audits, exact-artifact checks and fresh advisory validation remain mandatory. Changed dependencies, peers, Node, advisory records, any additional finding or a later release require reassessment. The separately fixed npm publisher keeps its zero-finding gate. No dependency override, forced transitive upgrade or automatic waiver is added.

The earlier decisions below are historical records. Prefer a compatible upstream fixed release, then remove this exception after complete lock/bundle and real-consumer verification.

## 0.7.0 owner acceptance — 2026-10-24

The owner explicitly accepted the remaining Void/Cloudflare consumer risks for **void-plugin-hono-jsx 0.7.0 only** after reviewing the reachable undici process-termination case and the Zod allocation behavior. This accepts risk; it does not repair the affected dependencies or make the audit zero. The reviewed root and locked consumers report 16 propagated entries (High 6, Moderate 10), representing the historical esbuild advisory and these four additional advisories:

| Affected consumer dependency | Advisory | Accepted risk and boundary |
| --- | --- | --- |
| undici 7.29.1, including Cloudflare/Miniflare copies | GHSA-4qv8-2p9j-2685 | EventSource parser memory exhaustion needs an affected EventSource connection. No such call was observed in the adapter path; this is not approval of arbitrary Node EventSource use. |
| undici 7.29.1 | GHSA-f72v-6w45-q472 | Mixed-case SRI tokens can bypass integrity checks. Inspected upstream fetch callers do not set SRI. Applications relying on this mechanism must use a fixed implementation; lowercase tokens are the upstream workaround. |
| undici 7.29.1, including distributed bundles | GHSA-xjj6-f33q-929c | **Reachable availability risk:** a malicious or malformed response from a contacted peer can terminate development/CLI tooling even after fetch rejection is caught. The owner accepts this residual risk for 0.7.0. A catch handler or local-only operation does not fix the dependency. |
| Zod 4.6.5, including distributed bundles | GHSA-mrhx-c7xc-m3w5 | Validation of oversized invalid collections can allocate many issues. Reviewed toolchain input is project configuration. Do not feed unbounded external data to affected validation; reject size before validation or use a fixed version. No anonymous application endpoint was proven vulnerable. |

Use trusted project configuration, keep development/preview interfaces private and avoid adding untrusted remote peers or affected validation/EventSource paths. These are usage limits, not code fixes or a claim that every upstream command is safe. Worker-native fetch, browser fetch and application-defined handlers require separate assessment. The adapter does not bundle undici/Zod implementations, but its required Void peer installs affected tooling.

The machine-readable `consumerRiskAcceptance` in `release-policy.json` binds this decision to version 0.7.0, Node 24.22.1, the reviewed Void peer range and SHA256 of the root/plain-Vite/Vite-Plus locks. Registry tarball integrity in those locks also fixes upstream bundled copies. The four complete OSV records have pinned modified values and content hashes; plan and stage refresh them. Changed locks, peers, runtime or advisory contents, missing advisory data, a withdrawn record, any new advisory, or a later adapter version require reassessment. Fresh root and both ordinary/Markdown consumer audits remain mandatory and nonzero. The original esbuild no-serve restriction remains.

Prefer upstream fixed releases (undici 7.30.1 and Zod >=4.6.6), then remove this release-specific exception after complete lock/bundle and consumer verification. Do not silently downgrade Void or insert transitive overrides. The separately fixed npm publisher retains its zero-finding gate, protected review, mandatory OIDC/provenance, same-byte validation and owner final approval. An interrupted or ambiguous stage submission must be reconciled with npm before retry; never automatically resubmit.

The original reachability evidence and its limits are in [rc-security-assessment.md](rc-security-assessment.md). The earlier decisions below are historical.

## Initial alpha acceptance

Current RC/normal preparation boundaries and update triggers are in [known-limitations.md](known-limitations.md); the dated RC reassessment is in [rc-security-assessment.md](rc-security-assessment.md). The dated alpha investigation below used the original filenames; the current JSX transform is `src/plugins/jsx-transform.ts`, while `src/plugins/hono-jsx.ts` is the composition entry.

On 2026-10-11, the maintainer accepted the remaining upstream esbuild advisory as a known limitation for preparing `void-plugin-hono-jsx@0.1.0-alpha.0` on `next`, without adding dependency overrides. This records acceptance of one advisory on the pinned peer baseline, not approval to upload, publish, disclose Git history or change repository visibility.

## Finding and dependency path

The previously reviewed root and locked-consumer audits reported five Moderate package entries from one distinct advisory, [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99). A root re-audit on 2026-10-11 reported six Moderate entries because the same advisory also propagated through `better-auth`'s Drizzle peer. It contained no additional advisory URL. Use the reports hashed in each candidate's evidence for its exact counts; propagated counts can differ without a change to the affected leaf. The affected leaf is esbuild 0.18.20:

```text
void@0.26.1
└─ drizzle-kit@0.31.11
   └─ @esbuild-kit/esm-loader@2.6.5
      └─ @esbuild-kit/core-utils@3.3.2
         └─ esbuild@0.18.20
```

The entries are `void`, `drizzle-kit`, `@esbuild-kit/esm-loader`, `@esbuild-kit/core-utils` and `esbuild`, with `better-auth` also present in the refreshed root report; they do not represent independent vulnerabilities. esbuild versions through 0.24.2 are affected, and 0.25.0 contains the advisory's fix.

The adapter archive ships no dependency implementation and has no direct esbuild dependency. Consumers still install the exact Void/Hono/Vite peers and their transitive dependencies. The archive's small dependency surface does not remove the consumer finding.

## Observed use and limits of the assessment

- `packages/hono-pages/src/plugins/hono-jsx.ts` uses Vite's `transformWithOxc` for JSX. `scripts/build-package.mjs` uses TypeScript's `tsc` to generate the package output.
- The installed `@esbuild-kit/core-utils/dist/index.js` uses esbuild's `transform` and `transformSync`; its ESM loader supplies TypeScript module loading. No esbuild `serve` invocation was found in the adapter or these loader modules.
- Void's installed DB/init/deploy tooling resolves Drizzle's CLI. That dependency belongs to the upstream framework; this adapter does not control its installation or every execution path.
- The advisory concerns esbuild's own development server allowing other websites to read responses through permissive CORS. The observed transform calls do not start that server. This is limited source inspection, not proof that every Void command or every consumer configuration is unreachable or safe.

Do not use the affected esbuild version's own serve feature. Reassess if a consumer adds it, a peer baseline changes, an upstream fix becomes available, or a new advisory appears. Development/preview checks validate the documented adapter behavior, not all upstream DB commands or managed production environments. The audit remains nonzero.

## Release policy

`release-policy.json` sets `dependencySecurityApproved: true` and lists only the exact GHSA URL in `approvedDependencyAdvisories`. Root and locked-consumer audits still run and are hashed into each candidate's evidence. A new advisory URL in either report continues to block the release plan. Changing framework peers requires another complete consumer run and a renewed assessment of this acceptance.

No override, forced transitive upgrade, dependency deletion or downgrade to npm audit's suggested Void 0.1.6 is part of this decision. Follow a compatible Void/Drizzle upstream fix instead. Include the limitation in the packed README and release notes so npm consumers receive it.

Publisher tooling is assessed separately in the [pnpm publisher assessment](pnpm-publisher-assessment.md), with the earlier npm comparison in [publisher-security.md](publisher-security.md). This esbuild acceptance does not cover publisher findings; the pnpm stage job has its own exact Rust finding ledger and fresh audit gate. Publication flags, owner/2FA, protected-environment review and history-disclosure requirements remain unchanged.
