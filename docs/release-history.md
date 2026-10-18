# Release history and verification records

Dated observations for completed releases. Current procedures are in [releasing](releasing.md).

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


## 0.2.0 publication

Published on 2026-10-18. [Release PR #113](https://github.com/ts-76/void-plugin-hono-jsx/pull/113) includes the README corrections from #112 and Markdown extensions from #114.
Source/tag: `2645572dcbbdbaedb234760bea442a9ff9e8c73e` / `v0.2.0`.
See the [release notes](https://github.com/ts-76/void-plugin-hono-jsx/releases/tag/v0.2.0) for the Markdown migration.

After npm owner approval, public artifact, signature/provenance and both registry consumer checks completed.
`latest` and `next` were aligned to `0.2.0`; `bootstrap` stayed at `0.0.0-bootstrap.0`.
The stage gate was returned to `false`. Real Workers/D1 evidence remains the RC.1 exercise above; no production ISR validation was added.
