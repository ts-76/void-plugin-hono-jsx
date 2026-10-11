# Release checklist

No release is authorized by this checklist. The package remains `private: true`, version `0.0.0`, with MIT license metadata until maintainers finish the remaining release decisions below.

## Decisions and access

- [x] Maintainer selected the package name `void-plugin-hono-jsx`.
- [x] Maintainer selected the MIT license. The license attributes project copyright to its contributors.
- [x] Add matching root/package MIT license files and package metadata.
- [x] Review upstream adaptation notices and include them in the tarball.
- [ ] Confirm npm name availability, publisher identity, ownership and account security.
- [ ] Choose an initial experimental version and release support policy.
- [ ] Decide repository visibility explicitly and review its full Git history before making it public.

## Verification

- [x] Activate `.github/workflows/package.yml` for pushes and pull requests using the pinned Node/framework baseline.
- [ ] Obtain a successful GitHub Actions run on the final release commit.
- [ ] Run typecheck, tests, Pages production build, packed-consumer checks and `npm run audit:release`.
- [ ] Review the packed file list, declarations, exports, peer versions, notices and license.
- [ ] Scan tracked content and Git history for credentials, personal paths and unintended artifacts. The automated audit covers the current tracked tree only; it cannot certify history or detect every secret.
- [ ] Confirm documentation matches the tested compatibility and unsupported modes. Record managed deployment validation separately.

## Publish only with explicit authorization

- [ ] Obtain maintainer approval for the exact release version and artifact.
- [ ] Set package publication metadata deliberately; verify registry and experimental dist-tag.
- [ ] Pack the artifact, record its checksum and perform a final dry run.
- [ ] Publish the reviewed artifact and verify installation from npm in a fresh consumer.
- [ ] Create the approved tag/release with validation evidence and limitations.
- [ ] Change repository visibility only if separately approved.

## Recovery

A failed validation blocks release. After publication, remove the affected dist-tag or deprecate the bad version with a concrete message, publish a corrected version, and repeat the clean-consumer checks. Preserve the last verified artifact and commit so consumers can pin them. Document affected versions and recovery commands; do not assume an npm version can be overwritten or unpublished.
