# Per-candidate release checklist

Use a fresh copy of the unchecked sections for each candidate; record its version/source/run rather than carrying old approvals forward. The [approved contract](release-contract.md) and [limitations ledger](known-limitations.md) define scope. Source manifests stay private; only the isolated candidate sets private false.

## Completed first-normal milestones — 2026-10-18

- [x] Source changes integrated and both supported Void 1.1 consumers selected; private reporting/SECURITY.md configured.
- [x] RC.1 OIDC/provenance stage, owner approval and public bytes/signatures/provenance/registry consumer verified. [Publication record](releasing.md#rc1-publication-and-workers-evidence).
- [x] Original consumer upgraded/cleaned (#61); local checks observed, GitHub CI not executed without a remote.
- [x] Dedicated real Workers/D1, migrations/redeploy/data retention, maintainer inspection and resource deletion/absence checks (#57, #109). [Actual verification](cloudflare-rc1-verification.md).
- [x] Normal 0.1.0 (#110): exact-head/main CI, normal GitHub Release, OIDC/provenance stage, owner approval, public bytes/signatures/provenance and both complete registry consumers passed; latest/next=0.1.0, bootstrap preserved, stage gate false. [Publication record](releasing.md#010-publication-and-tag-verification).

The immutable 0.1.0 README retains preparation-time wording. Issue #59 follows its source/next-package correction; this milestone does not claim that published README has changed.

## Grouped preparation and release PR

- [ ] Review and merge the grouped source/documentation changes only after exact-head required CI succeeds; verify main CI separately.
- [ ] Confirm Release Please default versioning, prerelease false, no prerelease-type/permanent release-as, and no repeated Release-As: 0.1.0 footer. The first-normal request is already consumed.
- [ ] Confirm the bot selects the intended next version and synchronizes root package/lock, package metadata, manifest and changelog. Do not hand-bump those files in the preparation PR.
- [ ] Review notes, supported APIs/ranges, installation guidance and source/maps/exports/license/notices in the exact packed artifact.
- [ ] Require final-head common source/history/secret/type/unit/browser checks and both full consumers on identical candidate bytes. Source/history scans are evidence, not a guarantee that every secret is absent.
- [ ] Review fresh root/consumer/Markdown audits and separate Linux publisher inventory/advisory checks. Preserve nonzero known findings and exact bounded acceptance; stop for new/changed unreviewed findings. Do not add overrides or broaden allowlists.

## Separately authorized release and stage

- [ ] Merge the reviewed release PR only after CI succeeds; verify main CI and the tag/source/normal GitHub Release. GitHub Release creation does not publish to npm.
- [ ] Re-read live repository/environment/owner/Trusted Publisher settings. Keep protected reviewer/no-bypass/OIDC/provenance and stage-only publisher scope unchanged.
- [ ] For the authorized matching tag only, enable NPM_STAGING_ENABLED and dispatch npm-stage; preparation and upload must use the exact same accepted run/attempt archive. Never rebuild after archive acceptance.
- [ ] Review fresh source/consumer/publisher evidence, then approve the protected environment. Stage the selected version on **next**, keeping latest unchanged.
- [ ] Check the receipt/version/source/digests; restore and verify NPM_STAGING_ENABLED=false on completion or failure. A stage receipt is not final npm approval or independent public signature verification.

## Public verification and promotion (#59)

- [ ] npm owner ts-76 completes the final review/2FA/Approve.
- [ ] Verify the selected public version metadata and byte equality with the accepted archive, registry signature, provenance subject/source/tag/workflow/run/certificate identity and clean registry consumers.
- [ ] With owner write authentication and tag-specific 2FA, move latest to the publicly verified normal version and align next; prereleases update next only. Verify live tags and clean no-version/@next/explicit-version selection, including README consistency.
- [ ] Preserve registration/bootstrap versions. Treat bootstrap tag cleanup as a separate explicit operation; no unpublish is part of normal promotion.
- [ ] Record exact version/source/run/attempt/digests, audit limits and remaining platform guarantees; update #59/#76/#85 at their actual completion boundary.

Production ISR (#58), managed Void platform and #99–#103 enhancements are outside the first guarantee. The unresolved local rejection/follow-up connection issue remains disclosed; successful direct HTTPS checks do not repair it.

## Historical records and recovery

Initial alpha decisions and completed checks remain in the [alpha.0 validation](stage-validation-result.md), [bootstrap record](bootstrap-registration.md), [release guide](releasing.md) and [pre-normal checklist snapshot](https://github.com/ts-76/void-plugin-hono-jsx/blob/54c0441a1d70fee55cad36a41f30f3308048e1f2/docs/release-checklist.md). These do not approve a later candidate.

A failed validation blocks release. After publication, select a concrete deprecation/tag recovery action, publish a corrected version and repeat clean-consumer checks. Preserve accepted bytes/source; do not assume a version can be overwritten or unpublished. This checklist alone authorizes no upload or tag change.
