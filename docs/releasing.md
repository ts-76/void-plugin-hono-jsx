# Release preparation and publication

The first normal release, **0.1.0**, is public. On 2026-10-18, independent public artifact/consumer verification completed and `latest` / `next` were aligned to 0.1.0; `bootstrap` remains `0.0.0-bootstrap.0`. Install `void-plugin-hono-jsx` for the default normal release, or pin `@0.1.0` to reproduce this version. `@next` is for candidate testing and may select a prerelease in a later cycle. See the [dated verification record](#010-publication-and-tag-verification). Alpha and RC evidence below is historical; alpha uses a different Void 0.x contract.

The normal 0.1.x series accepts Void `>=1.1.11 <1.2.0`, Hono `>=4.13.13 <5.0.0`, Vite `>=8.0.16 <9.0.0` and Node `>=24.21.0 <25.0.0`. Two active locked consumers cover Void 1.1.11 with plain Vite 8.3.4 and aligned Vite Plus/core 1.3.0. Old Void 0.26/0.27 and launcher fixtures remain historical inputs, not release-selectable targets. Refresh fixtures and review audits when upstream versions change; an accepted range is not evidence that future releases have already passed. See [the release contract](release-contract.md) for multipart, SSR mount, HMR, deferred, Markdown and platform boundaries.

RC preparation records the [fresh security reassessment](rc-security-assessment.md). Every final run repeats root/consumer/publisher checks under the same bounded acceptance; new or changed findings stop upload. The private reporting channel is enabled and [SECURITY.md](../SECURITY.md) defines support. The dedicated real Workers/D1 check and cleanup are [complete](cloudflare-rc1-verification.md); local ISR tests do not verify production ISR, which stays outside the guarantee.

## Release PR, version and tag

[Release Please](release-please.md) manages release PRs, synchronized private manifest versions, the root changelog, `v<version>` tags and GitHub Releases. Normal releases use default versioning and prerelease false, without a permanent release-as override. The one-time 0.1.0 request was consumed in #110; subsequent fixes and documentation changes use the normal patch flow. Keep private manifest versions at the last released version until the bot updates them. Merge its PR only after the required checks succeed. GitHub Release creation does not publish to npm: dispatch the existing stage workflow on the accepted tag and retain environment/owner approval. `NPM_STAGING_ENABLED` remains false until an authorized stage.

## Prepare and review

Use Node 24.21.0 and the locked npm dependencies. Commit the source first: preparation rejects a dirty checkout and any source change during validation.

```sh
npm ci
npx playwright install chromium
npm run release:prepare
npm run release:plan
```

Package build copies the release-please-managed root `CHANGELOG.md` into the ignored package changelog; artifact validation requires identical packed notes.

Preparation runs current-tree, full-history and Gitleaks scans, locked dependency audits, types, tests, both example builds, source browser checks and an external packed consumer. It creates an isolated manifest differing only in `private: false`; repository metadata stays private. The exact archive is installed in the consumer and passed to `npm publish --dry-run --ignore-scripts --provenance=false`. The dry run performs no registry upload and does not prove authentication or provenance.

The ignored `artifacts/` directory contains:

| File | Review purpose |
| --- | --- |
| `void-plugin-hono-jsx-<version>.tgz` | Exact reviewed candidate bytes (source/map additions apply after alpha.1): original src, dist JS/declarations with source/declaration maps, package metadata, README, changelog, license and notices. |
| `evidence.json` | Source commit, Node, file list, SHA256, SHA512 integrity and audit-report hashes. |
| `dependency-audit.json`, `consumer-dependency-audit.json` | Root and locked consumer findings, including peer-framework tooling. |
| `history-audit.json` | Full-history counts, finding categories and historical artifact paths; no matched secret values. |
| `dry-run.json` | Local npm dry-run result. |
| `release-plan.json` | Remaining blockers, selected artifact and required npm approval. |

CI runs the same preparation and retains files for seven days. Preserve the chosen run's artifact before it expires. Verify source commit, run/attempt and checksums before staging; never rebuild after accepting an archive. Gitleaks is pinned with its download digest. Template adaptations and their MIT license are recorded in [the template notice](release-template-notice.md).

## Security and disclosure decisions

The macOS local development runtime showed a connection reset on the request following a POST to an undefined named action when the connection was reused. The HTTP contract check isolates that deliberately invalid request with `Connection: close` and checks the expected 404 and subsequent 500 JSON body. Normal declared-action browser requests are tested without this header. This remains an unresolved local Void/Miniflare transport limitation. RC.1 direct Cloudflare HTTPS passed rejected/undefined-action POSTs followed by healthy GETs through normal pooling without retry or connection-close workarounds. That observation does not prove single-socket or every-platform behavior; see the [limitations ledger](known-limitations.md) and [actual Worker record](cloudflare-rc1-verification.md).

On 2026-10-11, Void 0.26.1 removed the High findings from the previous baseline. Propagated Moderate package entries remain from one [esbuild development-server advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99), through Void → drizzle-kit → @esbuild-kit. Refreshed audit reports can count additional propagation through better-auth's Drizzle peer without a new advisory; each candidate's hashed reports record the exact counts. The maintainer accepted this exact advisory as a known limitation for the pinned `0.1.0-alpha.0` candidate, without overrides. The [dependency assessment](dependency-security.md) records the dependency versions, observed transform use, advisory activation condition and unverified paths; the packed README and changelog disclose the limitation. The archive contains no dependency code, but consumers install these peers. `dependencySecurityApproved` is true and `approvedDependencyAdvisories` lists only that GHSA URL. Both root and consumer audits still run; any new unreviewed advisory blocks the plan. Reassess upstream fixes or peer changes rather than forcing a transitive override or downgrading Void to npm audit's suggested old 0.1.6. This decision does not authorize publication or accept publisher-tooling findings.

The stage job uses the pinned pnpm 12.14.0 Linux x64 native distribution directly; development, preparation and the npm lockfile remain on npm. This refresh replaces rustls 0.23.45 with 0.23.46 for RUSTSEC-2026-0346 without adding an advisory exception. The [pnpm publisher assessment](pnpm-publisher-assessment.md) records the exact Cargo-resolved inventory (517 crates), seven scoped known findings (the original four plus three explicitly approved ZIP-extraction findings whose affected APIs are not called by the fixed-tgz stage path), source/binary pins, isolated credentials and mandatory OIDC preflight. Every stage re-audits this inventory; new or changed findings and incomplete/service failures stop before upload. `pnpmVersion` and `scripts/release/publisher-policy.json` must be updated together only after revalidation. This remains a nonzero audit with a narrow acceptance. The historical real OIDC/provenance staging for source 1805f4f used pnpm 12.11.2; that historical result alone does not establish 12.14.0 behavior. Subsequent RC.0/RC.1 stages succeeded with 12.14.0; see the dated RC.1 record below. The maintainer approved that alpha on npm; public artifact checks and independent Sigstore/registry signature verification passed. See [the observed result](stage-validation-result.md), including the distinction between pre-approval bundle availability and post-publication verification. The repository stage gate remains false until a separately authorized stage. The earlier [npm CLI assessment](publisher-security.md) is retained as comparison evidence.

Source and history scans are evidence, not certification. On 2026-10-12 the maintainer renamed the repository to `void-plugin-hono-jsx`, made it public, and requested preservation of the original development history. The original 46 commits and merge structure are retained; only the alternate-account author/committer identities on 17 commits dated 2026-10-09 were corrected to the current maintainer account. Historical trees, messages and timestamps are unchanged. Parent SHA changes propagate to descendants, and 21 now-invalid GitHub commit signatures were removed. Repository/package naming and release preparation remain as an additional commit. Deleted merged branch refs are not recreated. Historical validation artifacts remain in past trees, so review the full-history report for each candidate. Old GitHub PR refs, cached commit URLs and external clones can retain previous commits and are outside the rewritten branch history. The corrected history remains the approved provenance source.

## First package and trusted publishing

The maintainer selected npm owner `ts-76`. Account access and auth-and-writes 2FA were verified in an isolated owner session during initial setup; see [the bootstrap registration record](bootstrap-registration.md). [npm staged publishing](https://docs.npmjs.com/staged-publishing/) created the publicly available `0.0.0-stage` placeholder, and a stage-only [trusted publisher](https://docs.npmjs.com/trusted-publishers/) was configured with workflow filename `npm-stage.yml` and environment `npm-stage`. Verify pending versions before another stage attempt. The [stage plan](stage-validation-plan.md) records the completed setup and procedure for future candidates. The owner also approved the registration-only bootstrap. Consumers now use the normal release on `latest`; the alpha setup details here are historical. The maintainer subsequently selected retagging `latest` from the placeholder to `0.1.0-alpha.1`; later alpha stages use `next` independently. Registration versions remain published.

Automated staging deliberately requires an existing package owned by `npmOwner`. It checks manual version-tag dispatch, main ancestry, protected environment reviewers, no admin bypass, public repository, CLI version, source commit, artifact digest and run/attempt before submitting the same archive. The workflow never performs final npm approval. The maintainer authorized proceeding with the actual stage validation. Policy flags are enabled; the final source CI passed and the matching tag was used for stage. The repository stage variable is false again after validation.

The public repository and approved restored development history satisfy the source-disclosure decision for the intended provenance path. npm [provenance requirements](https://docs.npmjs.com/generating-provenance-statements/) also require public package access. npm upload and final owner approval remain separate decisions.

The maintainer selected single-person GitHub review with User `ts-76` and `preventSelfReview: false`. The `npm-stage` environment has been configured with that required reviewer, no administrator bypass and only `v*` tags; its live settings match the stage gate. For a future release, commit its selected policy, verify CI, create its matching version tag, enable `NPM_STAGING_ENABLED` for the authorized stage and re-run preparation in the manual workflow. Preserve the existing alpha.0 tag and published bytes. No tag, GitHub release, registry upload or visibility change is performed by preparation or planning.

After owner approval, verify registry version, `next` dist-tag, provenance and a fresh npm-installed consumer. This completed for alpha.0: public bytes match the full-consumer-tested archive; a fresh registry installation verified all package files with peers omitted, and the public signature bundle passed independent verification. A passing local archive or staged receipt alone is not public-release verification. To require independent verification before approval on a future candidate, retain/retrieve the exact sent signature bundle; this stage receipt does not retain it.

## Distribution tag cleanup

On 2026-10-12 (Asia/Tokyo), direct deletion of `latest: 0.0.0-stage` returned HTTP 400 even after web 2FA; the registry response did not explain the rejection. No tag was removed. The maintainer then explicitly selected assigning `latest` to the already published `0.1.0-alpha.1`, preserving `next` and all published bytes/versions. The authenticated update and independent public-registry check succeeded:

| Tag | Selected version |
| --- | --- |
| `latest` | `0.1.0-alpha.1` |
| `next` | `0.1.0-alpha.1` |
| `bootstrap` | `0.0.0-bootstrap.0` |

That table records the historical 2026-10-12 retag operation. The 2026-10-18 normal-release promotion is recorded [below](#010-publication-and-tag-verification). Source/maps are included from alpha.2 onward; alpha.1 retains its original dist-only archive. Tags select versions and do not change their published bytes.

RC staging uses `next` and does not move `latest`. The approved normal-release policy is to stage each candidate on `next`, verify public bytes/signatures/provenance and a registry consumer, then move `latest` and align `next` to the normal version. Use owner write authentication and the tag-specific web 2FA; the stage-only Trusted Publisher cannot manage dist-tags. Re-read tags before changing them, preserve the accepted version's integrity and verify the public registry afterward. No registration version is unpublished.

```sh
npm dist-tag ls void-plugin-hono-jsx
# Only for an explicitly selected and publicly verified default version:
npm dist-tag add void-plugin-hono-jsx@0.1.0 latest
npm dist-tag ls void-plugin-hono-jsx
```

The dedicated owner session used for this change was logged out/revoked and removed; normal npm configuration was unchanged. [npm dist-tag documentation](https://docs.npmjs.com/cli/v12/commands/npm-dist-tag/)

## Alpha.2 stage and compatibility fix

Alpha.2 source/tag `96b9cc4edf439d8cad7bb90f5814128cf7fd0099` completed stage run `38202776733`, stage ID `1a79d282-2aa2-48f2-96da-013b63e62ecb`. Its 63-file tarball includes src/maps and matches the successful main candidate. Receipt verification found only the accepted dependency/publisher findings. The version remained unpublished when the running-Vite identity problem was reported. The run had already completed when cancellation was attempted; the repository stage gate was returned to false. Those staged bytes do not contain the compatibility fix. The 2026-10-17 registry check lists alpha.2 through alpha.4 as published, with `next` selecting alpha.4. Alpha.3 contains the fix; neither version's historical stage/signature evidence is evidence for the next release.

## RC.1 publication and Workers evidence

Verified on 2026-10-17/18. Source/tag `0506c47d9e79d4b9b7bcc96229f15a2e302de5a0` / `v0.1.0-rc.1`, [GitHub prerelease](https://github.com/ts-76/void-plugin-hono-jsx/releases/tag/v0.1.0-rc.1). [Stage run 39039816032 / attempt 1](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/39039816032/attempts/1) succeeded with pnpm 12.14.0 Linux x64, OIDC/provenance and protected review. Owner approval made RC.1 public on 2026-10-17 at 14:30:17 UTC (23:30:17 JST).

The downloaded public archive matched the accepted 115-file, 112448-byte candidate: SHA256 `49140f59244b40108427f02f230534b369608d9598729c8f8b8833b44fc45640`. npm 11.19.0 independently verified the package's registry signature and attestation (one each); provenance matched the subject digest, repository, workflow, source/tag, stage invocation and certificate identity. This package-level signature check omitted peers and is not a zero dependency audit.

The registry-installed plain Vite consumer matched all packaged files and passed types/dev/build/preview/browser, navigation/forms, islands/deferred/fallback, static, optional Markdown and local ISR. Vite Plus coverage used the same accepted bytes in main/stage CI; it was not rerun locally during that public check. The RC.1 audit remained five Moderate propagated entries from one known esbuild advisory, High/Critical zero; the publisher retained seven scoped findings. Every new candidate repeats fresh audits.

On 2026-10-18, the dedicated actual Cloudflare Worker/D1 exercise passed two migrations, redeployment/data retention, HTTPS/browser behavior and maintainer inspection. The resources were deleted and absence verified; the [record](cloudflare-rc1-verification.md) was merged in #109. Production ISR and managed Void platform remain outside that observation. This actual deployment used RC.1; the later 0.1.0 publication checks are recorded below. Repeat the [release checklist](release-checklist.md) for each new candidate.

## 0.1.0 publication and tag verification

Verified on 2026-10-18. [Release PR #110](https://github.com/ts-76/void-plugin-hono-jsx/pull/110) was merged after exact-head CI review. Source/tag `48f2a432e5b2621dcd2247cf4d916983f1e41277` / `v0.1.0` has a [normal GitHub Release](https://github.com/ts-76/void-plugin-hono-jsx/releases/tag/v0.1.0). Main consumer, publisher and Release Please runs passed. [Stage run 39110126490 / attempt 1](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/39110126490/attempts/1) passed prepare/stage with pnpm 12.14.0 Linux x64, protected review, OIDC preflight and provenance. Owner Approve made 0.1.0 public at 17:15:52.507 JST (08:15:52.507 UTC).

The downloaded public archive matched the reviewed PR/main and same-run accepted archive: 115 files, 112908 bytes, SHA256 `7ad441c31181012b4a41bf9c836a7504314fa69f652450431677b6736140a14e`. No rebuild occurred between acceptance and submission. npm 11.19.0 verified the package's registry signature and attestations with invalid/missing arrays empty. The SLSA subject digest, repository, source/tag, workflow, invocation and certificate identity matched. This signature-only install omitted peers; it is not dependency-wide signature verification or an audit-zero claim.

Both complete registry-installed consumers passed independently: Node 24.21.0 / Void 1.1.11 / Hono 4.13.13 with plain Vite 8.3.4 and aligned Vite Plus/core 1.3.0 (host Vite 8.3.4). All 115 installed files matched the archive, including src and source/declaration maps. Types, dev/build/preview and Chrome behavior passed for SSR/mount, navigation/layout/head, JSON/multipart forms, islands, deferred/groups/Suspense, fallback/View Transitions, static output, optional Markdown and local ISR. These are local registry-consumer checks, not a new Cloudflare deployment.

The four fresh consumer/Markdown audit reports each contained five Moderate propagated entries from the single known esbuild GHSA-67mh-4wv8-2f99; High/Critical were zero. The separate stage publisher assessment retained 517 crates and seven scoped findings. No overrides or expanded acceptance were introduced.

Owner write authentication and tag-specific Web2FA moved latest to 0.1.0. Next already selected 0.1.0, so no redundant update was made. Final tags were latest=0.1.0 / next=0.1.0 / bootstrap=0.0.0-bootstrap.0. Three fresh installs (unqualified, @next, explicit 0.1.0) selected the same version and matched all files/integrity; these selection-only installs omitted scripts/peers, separately from the complete consumers above. Published versions/bytes were preserved. The dedicated owner session was revoked and removed without changing normal npm settings; NPM_STAGING_ENABLED=false was verified.

The immutable 0.1.0 package README still contains preparation-time RC.1/unpublished wording. Issue #59 tracks the source and next-package documentation correction; publishing a corrected README requires a new package version. This does not change the verified runtime or authorize another stage. Actual Workers/D1 evidence remains the RC.1 exercise; production ISR and managed Void platform remain outside the guarantee.
