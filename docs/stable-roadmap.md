# Normal-release roadmap

Updated 2026-10-18. The first normal release, **0.1.0**, is public and verified; 1.0 waits for operational/API maintenance experience. The [release contract](release-contract.md) defines support; the [limitations ledger](known-limitations.md) records evidence and update triggers. The [alpha.4 source review](source-review-alpha4.md) remains the dated 2026-10-17 investigation.

## Completed gates

- Source integration: FormData, Void 1.1, Markdown snapshots, graph reuse and shared candidate/archive validation (#92); plugin naming (#94). Head/root measurements (#84) did not justify another change.
- Public contract, supported ranges and private vulnerability reporting (#85).
- RC.0 and RC.1 release PRs, OIDC/provenance stages, npm owner approval and public artifact verification. RC.1 includes navigation fallback and deferredResult/use/Suspense (#105); #98 ended NOT_PLANNED after evaluation, without an independent Transition API.
- RC.1 public bytes/signatures/provenance and registry-installed consumers. See [releasing](releasing.md#rc1-publication-and-workers-evidence).
- Original consumer cleanup and RC.1 / Void 1.1 update (#61); its remote-less GitHub CI was not executed.
- Dedicated direct Workers/D1 verification: two migrations, retained data, redeployment, maintainer inspection, deletion and absence checks (#57, record merged in #109). See [dated evidence](cloudflare-rc1-verification.md).
- Normal 0.1.0 release (#110): exact-head and main CI, normal GitHub Release, same-run OIDC/provenance stage, npm owner approval, public bytes/signatures/provenance and both complete registry consumers passed. Latest/next select 0.1.0; bootstrap is preserved. See the [publication record](releasing.md#010-publication-and-tag-verification).

## Documentation follow-up and subsequent releases

1. Correct the preparation-time RC.1/unpublished wording in source README, packed README and publication guidance (#59). Carry the packed README correction in the next patch release; do not overwrite public 0.1.0 bytes.
2. Review and merge the grouped documentation PR after exact-head required CI; verify main CI separately. Let Release Please generate the next patch PR with synchronized metadata/changelog. Review that PR and its packed README/CI before a separately authorized merge and stage.
3. Repeat the [per-candidate checklist](release-checklist.md), including fresh independent consumer/publisher audits. Keep NPM_STAGING_ENABLED=false during preparation. Preserve same-run/attempt archive acceptance, protected review, OIDC/provenance, owner approval and public verification before promoting a normal version.

Changes remain grouped; no individual source PR publication. A successful test, dry run, CI, stage receipt or GitHub Release alone is not public-release verification. Record each gate with exact source/version/run.

## Outside the first guarantee

Production ISR (#58), Markdown extras (#99), multipart GET reduction (#100), state-preserving HMR (#101), SSR DOM reuse (#102) and extra SSR streaming (#103) are follow-up work, not blockers added to the initial contract. The managed Void platform is unverified. Known local transport limitations remain disclosed; the actual HTTPS observation is not a universal fix.

Fixes target the latest normal series. Patches in 0.1.x preserve documented APIs; breaking changes move to 0.2.0 or later. See [SECURITY.md](../SECURITY.md). The relevant upstream is [voidzero-dev/void](https://github.com/voidzero-dev/void); Void-Framework/Void is an unrelated Kotlin project.
