# Release checklist

The initial candidate is **`void-plugin-hono-jsx@0.1.0-alpha.0`**, **`next`**, MIT. It is unpublished. Package metadata remains `private: true`; preparation changes only `private` in an isolated candidate. The source repository is public. Registry upload and npm approval require separate authorization.

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

- [x] Set npm owner to `ts-76`, as selected by the maintainer.
- [ ] Verify that account access, personal 2FA and package-name availability are ready. The name returned 404 during preparation; this does not reserve it. Previous local npm authentication returned 401; authentication has not been refreshed.
- [ ] Confirm each final candidate's root and consumer audits contain no advisory beyond the accepted GHSA-67mh-4wv8-2f99. Reassess acceptance after peer changes or upstream fixes; new unreviewed advisories block staging.
- [x] Select pnpm 12.11.2 for the stage job only; accept four exact Rust findings within the fixed-tarball scope, pin source/inventory/native distribution and enforce fresh fail-closed auditing. See the [pnpm assessment](pnpm-publisher-assessment.md).
- [ ] After authorized setup and enablement, verify real Trusted Publisher/OIDC and signed provenance staging, stopping before final npm approval; mock protocol and signing-failure checks do not prove registry acceptance. See the [live stage plan](stage-validation-plan.md).
- [x] Rename the public repository to `void-plugin-hono-jsx`; restore the original development and merge history, correcting only the alternate-account author/committer identities on 2026-10-09, as requested on 2026-10-12. Preserve naming/release preparation in an additional commit and validate the full history for each candidate; prior PR refs/cached views and external clones can retain previous commits.
- [x] Select single-person review: required reviewer User `ts-76`, `preventSelfReview: false`. Configure `npm-stage`, disable administrator bypass and allow only `v*` tags; verify the live API state against the stage gate.
- [ ] Commit the selected owner/reviewer policy and obtain CI evidence for the final main commit before enabling staging.
- [ ] Authorize the public `0.0.0-stage` placeholder from owner-controlled bootstrap staging and decide its CLI/auth/version, then configure a stage-only trusted publisher. Immediate alpha approval is not required for bootstrap; inspect pending state before subsequent staging.
- [ ] After separate authorization, update publication flags, repository variable `NPM_STAGING_ENABLED`, approved version tag and environment policy. Re-run preparation on that exact commit.
- [ ] Review the staged artifact and approve with npm owner personal 2FA; verify registry metadata, dist-tags, provenance and installation in a fresh consumer.

See [releasing](releasing.md) for artifact commands, first-package setup and support policy. This checklist records work and decisions; it does not authorize an upload or visibility change.

## Recovery

A failed validation blocks release. After publication, remove the affected dist-tag or deprecate the bad version with a concrete message, publish a corrected version, and repeat clean-consumer checks. Preserve the reviewed artifact and source commit. Do not assume an npm version can be overwritten or unpublished.
