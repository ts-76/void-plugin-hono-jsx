# Release checklist

Start a fresh checklist for each candidate. Record its version, source, run/attempt and archive digests.
Use the [release guide](releasing.md) and [support policy](release-contract.md).

## Preparation and release PR

- [ ] Group the selected changes and review final-head required CI. Check main CI separately after merge.
- [ ] Let Release Please synchronize versions and changelog. Review the selected version, breaking changes and migration notes.
- [ ] Verify packed README, source/maps, exports, licenses and notices. Source manifests remain private; only the isolated candidate is publishable.
- [ ] Require common source/history/secret/type/unit/browser checks and both complete consumers on identical bytes.
- [ ] Review fresh root/consumer/Markdown audits and the separate JavaScript publisher bundle inventory. Stop for new or changed unreviewed findings; preserve scoped acceptance without overrides.

## Stage

- [ ] Merge the reviewed release PR after required CI. Verify main CI, tag/source and GitHub Release.
- [ ] Verify live owner, Trusted Publisher and environment settings. Preserve protected review, no bypass, OIDC and provenance.
- [ ] Enable `NPM_STAGING_ENABLED` only for the approved tag and dispatch `npm-stage.yml`.
- [ ] Review the accepted artifact and evidence from that run/attempt, then approve the environment. Stage the same archive on `next`; do not rebuild it or move `latest`.
- [ ] Check the receipt/version/source/digests. Restore and verify `NPM_STAGING_ENABLED=false` after success or failure.

## Publication and promotion

- [ ] npm owner `ts-76` completes final review/2FA/Approve.
- [ ] Verify public bytes against the accepted archive, registry signature and provenance identity/source/tag/workflow/run.
- [ ] Run fresh registry consumers. Verify unqualified, `@next` and explicit-version installs and README consistency.
- [ ] With owner authentication, promote the verified normal version to `latest` and align `next`. Prereleases update `next` only.
- [ ] Preserve published/bootstrap versions. Treat bootstrap tag cleanup as a separate operation.
- [ ] Record checks, digests, audit limits and unverified platforms; update release-tracking issues.

A dry run, GitHub Release or stage receipt does not establish public verification.
Failed validation blocks release. For a published defect, choose an explicit tag/deprecation recovery and publish a corrected version; do not assume published bytes can be replaced.

See [release records](release-history.md) for completed releases and [known limitations](known-limitations.md) for exclusions.
