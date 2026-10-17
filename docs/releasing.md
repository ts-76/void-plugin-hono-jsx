# Preparing the 0.1.0 RC and normal release

Issue #85 selects `0.1.0-rc.0 / next`, followed by `0.1.0` after public RC and real Workers/D1 verification. As checked against the public registry on 2026-10-17 JST, `next` selects published `0.1.0-alpha.4`, `latest` remains `0.1.0-alpha.1`, and no RC is public yet. Alpha.4 has its earlier Void 0.x contract; it does not contain the upcoming Void 1.1 support or multipart transport. The alpha stage/signature and tag-cleanup records below are historical evidence for those versions only.

The upcoming release accepts Void `>=1.1.11 <1.2.0`, Hono `>=4.13.13 <5.0.0`, Vite `>=8.0.16 <9.0.0` and Node `>=24.21.0 <25.0.0`. Two active locked consumers cover Void 1.1.11 with plain Vite 8.3.4 and aligned Vite Plus/core 1.3.0. Old Void 0.26/0.27 and launcher fixtures remain historical inputs, not release-selectable targets. Refresh fixtures and review audits when upstream versions change; an accepted range is not evidence that future releases have already passed. See [the release contract](release-contract.md) for multipart, SSR mount, HMR, deferred, Markdown and platform boundaries.

RC preparation records the [fresh security reassessment](rc-security-assessment.md). Every final run repeats root/consumer/publisher checks under the same bounded acceptance; new or changed findings stop upload. The private reporting channel is enabled and [SECURITY.md](../SECURITY.md) defines support. Normal release additionally requires the dedicated real Workers/D1 check and cleanup; local ISR tests do not verify production ISR, which stays outside the guarantee.

## Release PR, version and tag

[Release Please](release-please.md) manages release PRs, synchronized private manifest versions, the root changelog, `v<version>` tags and GitHub prereleases. Merge its PR only after the required checks succeed. GitHub Release creation does not publish to npm: dispatch the existing stage workflow on the accepted tag and retain environment/owner approval. `NPM_STAGING_ENABLED` remains false until an authorized stage.

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

The macOS local development runtime showed a connection reset on the request following a POST to an undefined named action when the connection was reused. The HTTP contract check isolates that deliberately invalid request with `Connection: close` and checks the expected 404 and subsequent 500 JSON body. Normal declared-action browser requests are tested without this header. This is a known local Void/Miniflare transport limitation, not a repaired adapter feature; review it before the first alpha. Managed runtime behavior for this edge case is unverified.

On 2026-10-11, Void 0.26.1 removed the High findings from the previous baseline. Propagated Moderate package entries remain from one [esbuild development-server advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99), through Void → drizzle-kit → @esbuild-kit. Refreshed audit reports can count additional propagation through better-auth's Drizzle peer without a new advisory; each candidate's hashed reports record the exact counts. The maintainer accepted this exact advisory as a known limitation for the pinned `0.1.0-alpha.0` candidate, without overrides. The [dependency assessment](dependency-security.md) records the dependency versions, observed transform use, advisory activation condition and unverified paths; the packed README and changelog disclose the limitation. The archive contains no dependency code, but consumers install these peers. `dependencySecurityApproved` is true and `approvedDependencyAdvisories` lists only that GHSA URL. Both root and consumer audits still run; any new unreviewed advisory blocks the plan. Reassess upstream fixes or peer changes rather than forcing a transitive override or downgrading Void to npm audit's suggested old 0.1.6. This decision does not authorize publication or accept publisher-tooling findings.

The next stage job uses the pinned pnpm 12.14.0 Linux x64 native distribution directly; development, preparation and the npm lockfile remain on npm. This refresh replaces rustls 0.23.45 with 0.23.46 for RUSTSEC-2026-0346 without adding an advisory exception. The [pnpm publisher assessment](pnpm-publisher-assessment.md) records the exact Cargo-resolved inventory (517 crates), seven scoped known findings (the original four plus three explicitly approved ZIP-extraction findings whose affected APIs are not called by the fixed-tgz stage path), source/binary pins, isolated credentials and mandatory OIDC preflight. Every stage re-audits this inventory; new or changed findings and incomplete/service failures stop before upload. `pnpmVersion` and `scripts/release/publisher-policy.json` must be updated together only after revalidation. This remains a nonzero audit with a narrow acceptance. The historical real OIDC/provenance staging for source 1805f4f used pnpm 12.11.2; it does not prove a real registry exchange for 12.14.0. The maintainer approved that alpha on npm; public artifact checks and independent Sigstore/registry signature verification passed. See [the observed result](stage-validation-result.md), including the distinction between pre-approval bundle availability and post-publication verification. The repository stage gate remains false until a separately authorized stage. The earlier [npm CLI assessment](publisher-security.md) is retained as comparison evidence.

Source and history scans are evidence, not certification. On 2026-10-12 the maintainer renamed the repository to `void-plugin-hono-jsx`, made it public, and requested preservation of the original development history. The original 46 commits and merge structure are retained; only the alternate-account author/committer identities on 17 commits dated 2026-10-09 were corrected to the current maintainer account. Historical trees, messages and timestamps are unchanged. Parent SHA changes propagate to descendants, and 21 now-invalid GitHub commit signatures were removed. Repository/package naming and release preparation remain as an additional commit. Deleted merged branch refs are not recreated. Historical validation artifacts remain in past trees, so review the full-history report for each candidate. Old GitHub PR refs, cached commit URLs and external clones can retain previous commits and are outside the rewritten branch history. The corrected history remains the approved provenance source.

## First package and trusted publishing

The maintainer selected npm owner `ts-76`. Account access and auth-and-writes 2FA were verified in an isolated owner session during initial setup; see [the bootstrap registration record](bootstrap-registration.md). [npm staged publishing](https://docs.npmjs.com/staged-publishing/) created the publicly available `0.0.0-stage` placeholder, and a stage-only [trusted publisher](https://docs.npmjs.com/trusted-publishers/) was configured with workflow filename `npm-stage.yml` and environment `npm-stage`. Verify pending versions before another stage attempt. The [stage plan](stage-validation-plan.md) records the completed setup and procedure for future candidates. The owner also approved the registration-only bootstrap. Consumers use `@next` or an explicit alpha version. The maintainer subsequently selected retagging `latest` from the placeholder to `0.1.0-alpha.1`; later alpha stages use `next` independently. Registration versions remain published.

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

That table records the 2026-10-12 retag operation. A public-registry check on 2026-10-17 JST found `latest: 0.1.0-alpha.1`, `next: 0.1.0-alpha.4` and the same bootstrap tag. Source/maps are included from alpha.2 onward; alpha.1 retains its original dist-only archive. Prefer `@next` or an explicit version for alpha testing. Do not infer stable support from the `latest` label. No tag was changed during this release preparation.

RC staging uses `next` and does not move `latest`. The approved normal-release policy is to stage `0.1.0` on `next`, verify public bytes/signatures/provenance and a registry consumer, then move `latest` and align `next` to the normal version. Use owner write authentication and the tag-specific web 2FA; the stage-only Trusted Publisher cannot manage dist-tags. Re-read tags before changing them, preserve the accepted version's integrity and verify the public registry afterward. No registration version is unpublished.

```sh
npm dist-tag ls void-plugin-hono-jsx
# Only for an explicitly selected and publicly verified default version:
npm dist-tag add void-plugin-hono-jsx@0.1.0 latest
npm dist-tag ls void-plugin-hono-jsx
```

The dedicated owner session used for this change was logged out/revoked and removed; normal npm configuration was unchanged. [npm dist-tag documentation](https://docs.npmjs.com/cli/v12/commands/npm-dist-tag/)

## Alpha.2 stage and compatibility fix

Alpha.2 source/tag `96b9cc4edf439d8cad7bb90f5814128cf7fd0099` completed stage run `38202776733`, stage ID `1a79d282-2aa2-48f2-96da-013b63e62ecb`. Its 63-file tarball includes src/maps and matches the successful main candidate. Receipt verification found only the accepted dependency/publisher findings. The version remained unpublished when the running-Vite identity problem was reported. The run had already completed when cancellation was attempted; the repository stage gate was returned to false. Those staged bytes do not contain the compatibility fix. The 2026-10-17 registry check lists alpha.2 through alpha.4 as published, with `next` selecting alpha.4. Alpha.3 contains the fix; neither version's historical stage/signature evidence is evidence for the next release.
