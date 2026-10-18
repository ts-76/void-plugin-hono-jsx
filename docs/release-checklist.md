# First normal-release checklist

Updated 2026-10-18 for 0.1.0. The [approved contract](release-contract.md) and [limitations ledger](known-limitations.md) define scope. Checked RC items below are historical evidence for RC.1, not approval of the next candidate. Source manifests stay private; only the isolated candidate sets private false.

## Completed prerequisites

- [x] Source changes integrated and both supported Void 1.1 consumers selected; private reporting/SECURITY.md configured.
- [x] RC.1 OIDC/provenance stage, owner approval and public bytes/signatures/provenance/registry consumer verified. [Publication record](releasing.md#rc1-publication-and-workers-evidence).
- [x] Original consumer upgraded/cleaned (#61); local checks observed, GitHub CI not executed without a remote.
- [x] Dedicated real Workers/D1, migrations/redeploy/data retention, maintainer inspection and resource deletion/absence checks (#57, #109). [Actual verification](cloudflare-rc1-verification.md).

## Grouped preparation and release PR

- [ ] Review and merge the #62/#85 documentation/configuration preparation only after exact-head required CI succeeds; verify main CI separately.
- [ ] Confirm Release Please default versioning, prerelease false, no prerelease-type/permanent release-as, and a one-time preparation-merge footer Release-As: 0.1.0.
- [ ] Confirm the bot regenerates the pending RC.2 PR as **0.1.0** and synchronizes root package/lock, package metadata, manifest and changelog. Do not hand-bump those files in the preparation PR.
- [ ] Review notes, supported APIs/ranges, installation guidance and source/maps/exports/license/notices in the exact packed artifact.
- [ ] Require final-head common source/history/secret/type/unit/browser checks and both full consumers on identical candidate bytes. Source/history scans are evidence, not a guarantee that every secret is absent.
- [ ] Review fresh root/consumer/Markdown audits and separate Linux publisher inventory/advisory checks. Preserve nonzero known findings and exact bounded acceptance; stop for new/changed unreviewed findings. Do not add overrides or broaden allowlists.

## Separately authorized release and stage

- [ ] Merge the reviewed 0.1.0 release PR only after CI succeeds; verify main CI and the tag/source/normal GitHub Release. GitHub Release creation does not publish to npm.
- [ ] Re-read live repository/environment/owner/Trusted Publisher settings. Keep protected reviewer/no-bypass/OIDC/provenance and stage-only publisher scope unchanged.
- [ ] For the authorized matching tag only, enable NPM_STAGING_ENABLED and dispatch npm-stage; preparation and upload must use the exact same accepted run/attempt archive. Never rebuild after archive acceptance.
- [ ] Review fresh source/consumer/publisher evidence, then approve the protected environment. Stage 0.1.0 on **next**, keeping latest unchanged.
- [ ] Check the receipt/version/source/digests; restore and verify NPM_STAGING_ENABLED=false on completion or failure. A stage receipt is not final npm approval or independent public signature verification.

## Public verification and promotion (#59)

- [ ] npm owner ts-76 completes the final review/2FA/Approve.
- [ ] Verify public 0.1.0 metadata and byte equality with the accepted archive, registry signature, provenance subject/source/tag/workflow/run/certificate identity and clean registry consumers.
- [ ] With owner write authentication and tag-specific 2FA, move latest to publicly verified 0.1.0 and align next. Verify live tags and clean no-version/@next/explicit-version selection, including README consistency.
- [ ] Preserve registration/bootstrap versions. Treat bootstrap tag cleanup as a separate explicit operation; no unpublish is part of normal promotion.
- [ ] Record exact version/source/run/attempt/digests, audit limits and remaining platform guarantees; update #59/#76/#85 at their actual completion boundary.

Production ISR (#58), managed Void platform and #99–#103 enhancements are outside the first guarantee. The unresolved local rejection/follow-up connection issue remains disclosed; successful direct HTTPS checks do not repair it.

## Historical records and recovery

Initial alpha decisions and completed checks remain in the [alpha.0 validation](stage-validation-result.md), [bootstrap record](bootstrap-registration.md), [release guide](releasing.md) and [pre-normal checklist snapshot](https://github.com/ts-76/void-plugin-hono-jsx/blob/54c0441a1d70fee55cad36a41f30f3308048e1f2/docs/release-checklist.md). These do not approve a later candidate.

A failed validation blocks release. After publication, select a concrete deprecation/tag recovery action, publish a corrected version and repeat clean-consumer checks. Preserve accepted bytes/source; do not assume a version can be overwritten or unpublished. This checklist alone authorizes no upload or tag change.
