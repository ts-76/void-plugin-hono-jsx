# Approved release contract

Approved by the maintainer on 2026-10-17 in Issue #85. This contract applies to the upcoming RC/normal release, not to already published alpha artifacts. The current manifests stay at alpha.4 until Release Please creates the consolidated release PR.

## Version and support

Prepare 0.1.0-rc.0 on next, verify the published RC, then prepare 0.1.0. Patches in 0.1.x preserve the documented API; breaking changes move to 0.2.0 or later with migration notes. Decide on 1.0 after real use and API maintenance experience.

| Component | Accepted stable range | Locked release checks |
| --- | --- | --- |
| Node | >=24.21.0 <25.0.0 | 24.21.0 |
| Void | >=1.1.11 <1.2.0 | 1.1.11 |
| Hono | >=4.13.13 <5.0.0 | 4.13.13 |
| Vite | >=8.0.16 <9.0.0 | 8.3.4 |
| Vite Plus | Host Vite must meet the Vite range | 1.3.0, with vite aliased to the matching core |

Only the locked configurations are observed test results. An accepted range does not mean every future release has already passed. Refresh fixtures, source/consumer checks and audits before claiming a new upstream version verified. New Void minors and Node majors require an explicit support change.

Void 0.26/0.27 and the old Vite Plus scaffold are outside this release's support. Their manifests/locks remain historical comparison inputs. They cannot be selected for release preparation. This is a support decision, not a finding that every old Void execution path is unsafe.

## Public behavior

Pages SSR, navigation/layout/head, JSON forms/actions, explicit multipart forms, standard island policies, static output, documented full-Pages deferred behavior and optional Markdown form the initial scope. Run commands from the project root. Custom roots/monorepo invocation and additional platforms need separate validation.

JSON remains the default form body. Explicit multipart preserves files, repeated fields and the clicked submitter. Full Pages performs the mutation, then one GET through Void's public router on success; the destination must support GET. Loaders/deferred can rerun. JSON mutation's resolved-deferred retention does not apply. Cancellation prevents stale UI commits but cannot undo server writes. Island success reloads or redirects the document. Native uncontrolled/file fields are separate from the JSON model's dirty/reset state.

Browser mounting redraws SSR content; DOM reuse and state-preserving HMR are not promised. Deferred islands and static deferred output are unsupported. Failed deferred prefetch may resolve to null; use document/SPA streaming if error state is required. Markdown uses document navigation and accepts only the documented syntax and trusted repository-authored HTML; it does not sanitize untrusted HTML. Parser peers remain optional.

## Production boundary

Issue #57 is a normal-release gate: verify an actual dedicated Worker/D1, synthetic data, SSR/assets/API/navigation/actions/validation, migrations and redeployment. The maintainer selected the tsapp account and cleanup after verification; no additional paid plan is authorized. Prepare locally first, keep resource identifiers/credentials out of package files, and record cleanup.

Production ISR is outside the initial guarantee. Local KV/Cache tests are regression checks, not proof of production privacy, propagation, purge or concurrent regeneration. Issue #58 remains open. The managed Void platform is also unverified. Do not deploy the local ISR fixture's placeholder binding or test-control API.

## Release and security gates

Changes remain grouped in release/stable-preparation and integration PR #92. Use one consolidated RC; do not publish each source PR separately. Release Please uses the rc prerelease strategy. The main integration squash commit requests the exact initial RC with a one-time `Release-As: 0.1.0-rc.0` footer; do not leave a permanent release-as override in config.

RC uses next and a GitHub prerelease. Keep protected environment review, exact same-run/attempt bytes, fresh source/consumer/publisher audits, OIDC/provenance and npm owner approval. A stage is not publicly installable before approval. After approval, verify bytes/signatures/provenance and a registry-installed consumer, then run the real Workers checks.

For 0.1.0, switch Release Please to default versioning with prerelease false, remove prerelease-type and request 0.1.0 once. Stage on next so the existing latest is retained until public artifact/consumer verification. Then promote latest and align next to the same normal version. Future RCs update only next. Metadata/policy tags must match; prereleases cannot use latest. Ordinary source manifests stay private; only the isolated candidate changes private to false.

Alpha dependency exceptions are not automatically normal-release approval. Re-evaluate each exact advisory/version/path for the RC and record the result before re-enabling dependency-security approval. The preparation reassessment is recorded in [rc-security-assessment.md](rc-security-assessment.md); each final candidate still repeats fresh checks. Fresh new/changed findings stop upload. Publisher acceptance is limited to the pinned Linux x64 binary and exact tgz stage command; it does not approve general installs or other pnpm commands. See SECURITY.md for reporting and support policy.
