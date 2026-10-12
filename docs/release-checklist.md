# Release checklist

The initial candidate is **`void-plugin-hono-jsx@0.1.0-alpha.0`**, **`next`**, MIT. It is published on `next` after the maintainer approved it on npm. Package metadata remains `private: true`; preparation changes only `private` in an isolated candidate. The source repository is public. The authorized OIDC/provenance stage upload succeeded; owner approval, public metadata/bytes and independent signature verification are confirmed. At the initial verification, `latest` pointed to the registration placeholder. Users select `@next`; the current [tag policy](releasing.md#distribution-tag-cleanup) reserves `latest` for stable publication. See [the validation result](stage-validation-result.md).

## Selected policy

- [x] Package name, MIT license, notices and experimental version/dist-tag selected by the maintainer.
- [x] Upgrade the baseline to Void 0.26.1; retain Hono 4.13.13, Vite 8.3.3 and Node 24.21.0.
- [x] Document supported behavior and unsupported modes; managed deployment remains unverified.
- [x] Keep final npm approval outside automation and close the repository stage gate after the authorized validation.
- [x] Add exact-artifact preparation, checksum verification, clean-consumer validation, full-history audits and CI artifact retention.
- [x] Accept only GHSA-67mh-4wv8-2f99 as a known upstream limitation for the pinned alpha baseline, without overrides; disclose it in the packed README and release notes. See the [dependency assessment](dependency-security.md).

## Evidence for alpha.0 (repeat for every new candidate)

- [x] Obtain a successful full `npm run release:prepare` on the final clean commit and passing GitHub Actions for that exact commit.
- [x] Review `artifacts/evidence.json`, tarball contents, declarations, exports, license/notices, release notes and checksums.
- [x] Review root and locked-consumer dependency audit reports separately from publisher tooling.
- [x] Review `artifacts/history-audit.json` and Gitleaks output; automated scans cannot certify every secret or approve disclosure.
- [x] Confirm the selected source plan is ready after the approved decisions; retain the exact run/attempt evidence.

## Remaining decisions and setup

- [ ] Resolve or separately assess the disclosed macOS local development connection-reset limitation after an undefined-action POST and managed deployment behavior (see releasing). These remain unverified beyond the documented local contract.

- [x] Set npm owner to `ts-76`, as selected by the maintainer.
- [x] Verify real ts-76 login / auth-and-writes 2FA, initial package registration and stage-only Trusted Publisher save.
- [x] Confirm each final candidate's root and consumer audits contain no advisory beyond the accepted GHSA-67mh-4wv8-2f99. Reassess acceptance after peer changes or upstream fixes; new unreviewed advisories block staging.
- [x] Select pnpm 12.11.2 for the stage job only; accept four exact Rust findings within the fixed-tarball scope, pin source/inventory/native distribution and enforce fresh fail-closed auditing. See the [pnpm assessment](pnpm-publisher-assessment.md).
- [x] Confirm real OIDC exchange, provenance-enabled native stage success, registry trusted automation actor and downloaded alpha digest.
- [x] Retrieve the published attestation bundle and independently verify signature / issuer / workflow / source / SHA512 subject / CT and transparency logs, plus npm registry signature. Verification completed after owner approval; pre-approval stage view/download did not expose the bundle.
- [x] Rename the public repository to `void-plugin-hono-jsx`; restore the original development and merge history, correcting only the alternate-account author/committer identities on 2026-10-09, as requested on 2026-10-12. Preserve naming/release preparation in an additional commit and validate the full history for each candidate; prior PR refs/cached views and external clones can retain previous commits.
- [x] Select single-person review: required reviewer User `ts-76`, `preventSelfReview: false`. Configure `npm-stage`, disable administrator bypass and allow only `v*` tags; verify the live API state against the stage gate.
- [x] Commit selected policy and verify Package / Publisher CI on final stage source 1805f4f before creating the tag.
- [x] Register the public placeholder with owner-controlled npm 12.2.0 bootstrap 0.0.0-bootstrap.0, verify downloaded bytes and save stage-only trust. The owner subsequently approved bootstrap on npm; it contains registration files only and is not the adapter.
- [x] Run authorized stage on v0.1.0-alpha.0 / 1805f4f with same-run prepare artifacts and environment approval; return NPM_STAGING_ENABLED to false afterward.
- [x] Confirm owner approval on npm and verify public metadata, `next`, exact bytes, provenance and fresh registry installation. The post-publication check omitted peers; full runtime/browser integration passed on the identical accepted archive in stage prepare CI.

See [releasing](releasing.md) for artifact commands, first-package setup and support policy. This checklist records work and decisions; it does not authorize an upload or visibility change.

## Recovery

A failed validation blocks release. After publication, remove the affected dist-tag or deprecate the bad version with a concrete message, publish a corrected version, and repeat clean-consumer checks. Preserve the reviewed artifact and source commit. Do not assume an npm version can be overwritten or unpublished.
