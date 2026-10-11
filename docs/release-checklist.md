# Release checklist

The initial candidate is **`void-plugin-hono-jsx@0.1.0-alpha.0`**, **`next`**, MIT. It is unpublished. Source metadata remains `private: true`; preparation changes only `private` in an isolated candidate. Registry upload, npm approval and repository visibility changes require separate authorization.

## Selected policy

- [x] Package name, MIT license, notices and experimental version/dist-tag selected by the maintainer.
- [x] Upgrade the baseline to Void 0.26.1; retain Hono 4.13.13, Vite 8.3.3 and Node 24.21.0.
- [x] Document supported behavior and unsupported modes; managed deployment remains unverified.
- [x] Keep automatic publication disabled in `release-policy.json`.
- [x] Add exact-artifact preparation, checksum verification, clean-consumer validation, full-history audits and CI artifact retention.
- [x] Accept only GHSA-67mh-4wv8-2f99 as a known upstream limitation for the pinned alpha baseline, without overrides; disclose it in the packed README and release notes. See the [dependency assessment](dependency-security.md).

## Evidence for each candidate

- [ ] Obtain a successful full `npm run release:prepare` on the final clean commit and passing GitHub Actions for that exact commit.
- [ ] Review `artifacts/evidence.json`, tarball contents, declarations, exports, license/notices, release notes and checksums.
- [ ] Review root and locked-consumer dependency audit reports separately from publisher tooling.
- [ ] Review `artifacts/history-audit.json` and Gitleaks output; automated scans cannot certify every secret or approve disclosure.
- [ ] Confirm `npm run release:plan` reports expected blockers until remaining decisions are approved.

## Remaining decisions and setup

- [ ] Review the known macOS local development connection-reset limitation after an undefined-action POST before approving the first alpha (see releasing).

- [ ] Confirm npm owner identity, package-name availability, account access and personal 2FA. The name returned 404 during preparation; this does not reserve it. Local npm authentication returned 401.
- [ ] Confirm each final candidate's root and consumer audits contain no advisory beyond the accepted GHSA-67mh-4wv8-2f99. Reassess acceptance after peer changes or upstream fixes; new unreviewed advisories block staging.
- [ ] Select and audit a suitable publisher CLI. The tested npm 11.21.0 has bundled dependency findings; the stage job blocks Moderate or higher findings before upload.
- [ ] Decide repository visibility and full-history disclosure. This repository is private. Preparation found deleted evidence artifacts in history; public provenance requires a public repository and public package.
- [ ] Select `npm-stage` environment reviewers and decide self-review policy. Configure required reviewers, disable administrator bypass and allow only `v*` tags. The default `preventSelfReview: true` needs another reviewer.
- [ ] Set up the first package through owner-controlled staged publishing, then configure a stage-only trusted publisher for this repository, workflow and environment.
- [ ] After separate authorization, update publication flags, repository variable `NPM_STAGING_ENABLED`, approved version tag and environment policy. Re-run preparation on that exact commit.
- [ ] Review the staged artifact and approve with npm owner personal 2FA; verify registry metadata, dist-tags, provenance and installation in a fresh consumer.

See [releasing](releasing.md) for artifact commands, first-package setup and support policy. This checklist records work and decisions; it does not authorize an upload or visibility change.

## Recovery

A failed validation blocks release. After publication, remove the affected dist-tag or deprecate the bad version with a concrete message, publish a corrected version, and repeat clean-consumer checks. Preserve the reviewed artifact and source commit. Do not assume an npm version can be overwritten or unpublished.
