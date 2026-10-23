# Support policy

The adapter supports the documented Pages APIs on the following stable framework ranges.

## Version and support

| Dependency | Supported range | Tested version |
| --- | --- | --- |
| Node.js | >=24.21.0 <25.0.0 | 24.21.0 |
| Void | >=1.2.1 <1.3.0 | 1.2.1 |
| Hono | >=4.13.13 <5.0.0 | 4.13.13 |
| Vite | >=8.0.16 <9.0.0 | 8.3.4 |
| Vite Plus | Host Vite must satisfy the Vite range | 1.3.0 with matching core alias |

Void 1.2.1 is the minimum supported version; upgrade Void together with this adapter. The router uses its public `refreshPage` helper so refresh refetches hashed URLs without adding history entries, while `preserveState` visits update the address bar.

Only the listed versions are tested results. New releases within a range need refreshed fixtures and audits before being described as verified.
Void 0.x and historical launchers are unsupported. Run commands from the project root; custom-root and monorepo invocation need separate validation.

Patches preserve the documented API within the latest normal minor series. Breaking changes use a new minor while the package is below 1.0, with migration notes.
Security fixes target the latest normal series; see [SECURITY.md](../SECURITY.md).

## Public behavior

Supported features include Pages SSR, navigation/layout/head, JSON and explicit multipart forms, islands, static output, full-Pages deferred data and optional Markdown.
See the [Pages guide](pages.md) and [Markdown guide](markdown.md) for their contracts.

Multipart success performs one GET; the destination must support it and loaders/deferred can rerun.
Native field/file state is separate from the JSON model. Cancellation cannot undo server writes.
Browser mounting redraws SSR content. State-preserving HMR, deferred islands and static deferred output are unsupported.
Markdown accepts trusted authored HTML without sanitization.

## Production boundary

Direct Cloudflare Workers/D1 deployment, migrations and redeployment were [verified with RC.1](cloudflare-rc1-verification.md).
Direct Workers ISR has a [0.2.0 verification record](isr-cloudflare-verification.md), including an unresolved query-variant purge failure. Immediate/global invalidation and single-flight regeneration are not guaranteed. The managed Void platform remains unverified.

## Release and security gates

Changes are grouped through Release Please. Review required CI on the final release head and main.
Stage the accepted same-run/attempt archive on `next`, with protected review, OIDC and provenance.
After npm owner approval, verify public bytes, signatures/provenance and registry consumers before promoting a normal version to `latest`.

Repeat fresh consumer and publisher audits for each candidate. Historical advisory acceptance does not approve new findings or other execution paths.
The [limitations ledger](known-limitations.md) defines update triggers; the [release checklist](release-checklist.md) records required gates.
