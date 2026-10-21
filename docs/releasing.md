# Releasing

Maintainer procedure for grouped releases. [Release Please](release-please.md) manages versions, changelog, tags and GitHub Releases.
Use the [checklist](release-checklist.md) for each candidate.

## Prepare and review

Use Node 24.21.0 and a clean, committed checkout:

```sh
npm ci
npx playwright install chromium
npm run release:prepare
npm run release:plan
```

Preparation checks source/history/secrets, dependencies, types, tests, both example builds and browser behavior.
It packs an isolated publishable manifest and tests the archive in a clean consumer.
The repository manifests remain private.

| Artifact under `artifacts/` | Purpose |
| --- | --- |
| `void-plugin-hono-jsx-<version>.tgz` | Candidate archive, including source, maps, README, changelog and licenses. |
| `evidence.json` | Source, environment, file list, digests and audit hashes. |
| Dependency audit reports | Root, consumer and optional Markdown findings. |
| `history-audit.json` | History scan results without matched secret values. |
| `dry-run.json` | Local publication validation; no upload. |
| `release-plan.json` | Candidate selection and remaining blockers. |

The dry-run helper uses `--force` only to skip registry version collisions, together with `--dry-run --ignore-scripts --provenance=false`.
The real stage command does not use that flag. Dry runs do not verify authentication or provenance.

Both supported consumers must pass on identical bytes. Review required CI on the release PR's final head and on main after merge.
CI artifacts expire after seven days; retain the selected archive and evidence before expiry.

## Stage and approve

1. Review the generated release PR, merge after required CI, and verify its `v<version>` tag/source and GitHub Release.
2. Verify the live owner, Trusted Publisher and protected environment settings. The publisher is stage-only; final approval belongs to npm owner `ts-76`.
3. Enable `NPM_STAGING_ENABLED` only for the approved tag, then dispatch `npm-stage.yml` on that tag.
4. Review preparation evidence from that run/attempt before approving the protected environment. Submit its accepted archive without rebuilding it.
5. Check the receipt, then restore and verify `NPM_STAGING_ENABLED=false`, including after failure.
6. The npm owner completes the final review and Approve on npm.

Keep protected review, no administrator bypass, OIDC preflight and provenance enabled.
A GitHub Release or stage receipt does not establish npm publication.

## Public verification and tags

After approval, compare public bytes with the accepted archive.
Verify the registry signature, provenance digest/source/tag/workflow/run/certificate identity and fresh registry consumers.
Then promote a normal release to `latest` and align `next`. Prereleases update `next` only.

Dist-tag changes require owner write authentication and may require additional 2FA.
Re-read tags before and after changing them. Verify unqualified, `@next` and explicit-version installs.
Preserve published versions and registration/bootstrap artifacts; bootstrap tag cleanup is a separate decision.

## Security gates

Review fresh consumer and JavaScript publisher bundle audits separately. Known findings require the exact reviewed scope; new or changed unreviewed findings block upload.
Do not add transitive overrides or broaden acceptance to pass a check.
See the [limitations and update policy](known-limitations.md#dependency-and-publisher-boundaries).

## RC.1 publication and Workers evidence

See the [RC.1 publication record](release-history.md#rc1-publication-and-workers-evidence) and [Workers/D1 verification](cloudflare-rc1-verification.md).

## 0.1.0 publication and tag verification

See the [0.1.0 publication record](release-history.md#010-publication-and-tag-verification).

## 0.2.0 publication

See the [0.2.0 record](release-history.md#020-publication) and [release notes](https://github.com/ts-76/void-plugin-hono-jsx/releases/tag/v0.2.0).
