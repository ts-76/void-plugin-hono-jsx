# Preparing an experimental npm release

The first candidate is `void-plugin-hono-jsx@0.1.0-alpha.0` with the `next` tag. Only the exact peer versions in its manifest are supported. A future Void/Hono/Vite upgrade requires another complete consumer run and candidate release; do not broaden peer ranges based on a build alone. Managed deployment is unverified, browser mounting redraws SSR content, and unsupported features are listed in the package guide.

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

The stage job now uses the pinned pnpm 12.11.2 Linux x64 native distribution directly; development, preparation and the npm lockfile remain on npm. The [pnpm publisher assessment](pnpm-publisher-assessment.md) records the exact Cargo-resolved inventory (517 crates), four scoped known findings, source/binary pins, isolated credentials and mandatory OIDC preflight. Every stage re-audits this inventory; new or changed findings and incomplete/service failures stop before upload. `pnpmVersion` and `scripts/release/publisher-policy.json` must be updated together only after revalidation. This is a nonzero audit with a narrow acceptance, not a repaired dependency tree. Real OIDC/provenance staging succeeded for source 1805f4f. The maintainer approved alpha on npm; public artifact checks and independent Sigstore/registry signature verification passed. See [the observed result](stage-validation-result.md), including the distinction between pre-approval bundle availability and post-publication verification. Policy flags are enabled, but the repository stage gate was returned to false after this validation to prevent another submission. The earlier [npm CLI assessment](publisher-security.md) is retained as comparison evidence.

Source and history scans are evidence, not certification. On 2026-10-12 the maintainer renamed the repository to `void-plugin-hono-jsx`, made it public, and requested preservation of the original development history. The original 46 commits and merge structure are retained; only the alternate-account author/committer identities on 17 commits dated 2026-10-09 were corrected to the current maintainer account. Historical trees, messages and timestamps are unchanged. Parent SHA changes propagate to descendants, and 21 now-invalid GitHub commit signatures were removed. Repository/package naming and release preparation remain as an additional commit. Deleted merged branch refs are not recreated. Historical validation artifacts remain in past trees, so review the full-history report for each candidate. Old GitHub PR refs, cached commit URLs and external clones can retain previous commits and are outside the rewritten branch history. The corrected history remains the approved provenance source.

## First package and trusted publishing

The maintainer selected npm owner `ts-76`. Live account access and auth-and-writes 2FA have now been verified in an isolated owner session; see [the bootstrap registration record](bootstrap-registration.md). Check name availability immediately before setup. [npm staged publishing](https://docs.npmjs.com/staged-publishing/) supports a first package and creates a publicly available `0.0.0-stage` placeholder; the staged candidate contents stay unavailable to the public until approval. Decide the owner-controlled bootstrap CLI/auth/version separately, then configure a stage-only [trusted publisher](https://docs.npmjs.com/trusted-publishers/) with workflow filename `npm-stage.yml` and environment `npm-stage`. Bootstrap does not require immediate final approval of the alpha. Verify pending versions before another stage attempt. The [stage plan](stage-validation-plan.md) records the completed setup and procedure for future candidates. The owner also approved the registration-only bootstrap. Consumers use `@next` or an explicit alpha version. After public alpha verification, the maintainer explicitly selected retagging `latest` from the placeholder to `0.1.0-alpha.1`. Both `latest` and `next` now select that experimental alpha; this is not a declaration of stability. Registration versions remain published.

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

An unqualified `npm install void-plugin-hono-jsx` now installs an experimental alpha with implementation files. Prefer `@next` or an explicit version for alpha testing. Do not infer stable support from the `latest` label. Published alpha.1 still has its original dist-only archive; source/map additions require the next release.

Future alpha staging continues to use `next`; it does not automatically move `latest`. Updating the default version is a separate maintainer decision after public artifact verification. Use owner write authentication and the tag-specific web 2FA; the stage-only Trusted Publisher cannot manage dist-tags. Re-read tags before changing them, preserve the accepted version's integrity and verify the public registry afterward. No registration version is unpublished.

```sh
npm dist-tag ls void-plugin-hono-jsx
# Only for an explicitly selected and publicly verified default version:
npm dist-tag add void-plugin-hono-jsx@0.1.0-alpha.1 latest
npm dist-tag ls void-plugin-hono-jsx
```

The dedicated owner session used for this change was logged out/revoked and removed; normal npm configuration was unchanged. [npm dist-tag documentation](https://docs.npmjs.com/cli/v12/commands/npm-dist-tag/)
