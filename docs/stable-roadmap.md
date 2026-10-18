# Roadmap to the first normal release

Updated 2026-10-18. Issue #85 selects **0.1.0** as the first normal release; 1.0 waits for operational/API maintenance experience. The [release contract](release-contract.md) defines support; the [limitations ledger](known-limitations.md) records evidence and update triggers. The [alpha.4 source review](source-review-alpha4.md) remains the dated 2026-10-17 investigation.

## Completed gates

- Source integration: FormData, Void 1.1, Markdown snapshots, graph reuse and shared candidate/archive validation (#92); plugin naming (#94). Head/root measurements (#84) did not justify another change.
- Public contract, supported ranges and private vulnerability reporting (#85).
- RC.0 and RC.1 release PRs, OIDC/provenance stages, npm owner approval and public artifact verification. RC.1 includes navigation fallback and deferredResult/use/Suspense (#105); #98 ended NOT_PLANNED after evaluation, without an independent Transition API.
- RC.1 public bytes/signatures/provenance and registry-installed consumers. See [releasing](releasing.md#rc1-publication-and-workers-evidence).
- Original consumer cleanup and RC.1 / Void 1.1 update (#61); its remote-less GitHub CI was not executed.
- Dedicated direct Workers/D1 verification: two migrations, retained data, redeployment, maintainer inspection, deletion and absence checks (#57, record merged in #109). See [dated evidence](cloudflare-rc1-verification.md).

## Remaining 0.1.0 gates

1. Finish the grouped #62/#85 documentation and normal-release configuration. Release Please uses default versioning/prerelease false, no prerelease-type or permanent release-as. Request 0.1.0 once in the preparation merge footer; let the bot update versions/changelog. The already-open RC.2 release PR must be regenerated as 0.1.0 before review/merge.
2. Review the generated **0.1.0** release PR: synchronized root/lock/package/manifest versions, complete user notes/source/maps/exports and all final-head consumer/publisher checks. Refresh independent audits; new/changed unreviewed findings stop release work. RC evidence cannot substitute for this candidate.
3. Merge that release PR only after review, then verify main CI, source/tag and the normal GitHub Release. Authorize stage separately; keep NPM_STAGING_ENABLED=false during preparation. Stage the same-run/attempt accepted archive on next with protected review/OIDC/provenance, then close the stage gate again.
4. npm owner approves; independently verify public bytes, registry signature, provenance/source/run and clean registry consumers. Only afterward move latest and align next to 0.1.0 (#59). Keep bootstrap versions published; bootstrap tag cleanup is a distinct explicit operation.

Changes remain grouped; no individual source PR publication. A successful test, dry run, CI, stage receipt or GitHub Release alone is not public-release verification. Record each gate with exact source/version/run.

## Outside the first guarantee

Production ISR (#58), Markdown extras (#99), multipart GET reduction (#100), state-preserving HMR (#101), SSR DOM reuse (#102) and extra SSR streaming (#103) are follow-up work, not blockers added to the initial contract. The managed Void platform is unverified. Known local transport limitations remain disclosed; the actual HTTPS observation is not a universal fix.

Fixes target the latest normal series. Patches in 0.1.x preserve documented APIs; breaking changes move to 0.2.0 or later. See [SECURITY.md](../SECURITY.md). The relevant upstream is [voidzero-dev/void](https://github.com/voidzero-dev/void); Void-Framework/Void is an unrelated Kotlin project.
