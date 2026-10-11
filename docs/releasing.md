# Preparing an experimental npm release

The first candidate is `void-plugin-hono-jsx@0.1.0-alpha.0` with the `next` tag. Only the exact peer versions in its manifest are supported. A future Void/Hono/Vite upgrade requires another complete consumer run and candidate release; do not broaden peer ranges based on a build alone. Managed deployment is unverified, browser mounting redraws SSR content, and unsupported features are listed in the package guide.

## Prepare and review

Use Node 24.21.0 and the locked npm dependencies. Commit the source first: preparation rejects a dirty checkout and any source change during validation.

```sh
npm ci
npx playwright install chromium
npm run release:prepare
npm run release:plan
```

Preparation runs current-tree, full-history and Gitleaks scans, locked dependency audits, types, tests, both example builds, source browser checks and an external packed consumer. It creates an isolated manifest differing only in `private: false`; repository metadata stays private. The exact archive is installed in the consumer and passed to `npm publish --dry-run --ignore-scripts --provenance=false`. The dry run performs no registry upload and does not prove authentication or provenance.

The ignored `artifacts/` directory contains:

| File | Review purpose |
| --- | --- |
| `void-plugin-hono-jsx-0.1.0-alpha.0.tgz` | Exact reviewed bytes: dist JS/declarations, package metadata, README, changelog, license and notices. |
| `evidence.json` | Source commit, Node, file list, SHA256, SHA512 integrity and audit-report hashes. |
| `dependency-audit.json`, `consumer-dependency-audit.json` | Root and locked consumer findings, including peer-framework tooling. |
| `history-audit.json` | Full-history counts, finding categories and historical artifact paths; no matched secret values. |
| `dry-run.json` | Local npm dry-run result. |
| `release-plan.json` | Remaining blockers, selected artifact and required npm approval. |

CI runs the same preparation and retains files for seven days. Preserve the chosen run's artifact before it expires. Verify source commit, run/attempt and checksums before staging; never rebuild after accepting an archive. Gitleaks is pinned with its download digest. Template adaptations and their MIT license are recorded in [the template notice](release-template-notice.md).

## Security and disclosure decisions

On 2026-10-11, Void 0.26.1 removed the High findings from the previous baseline. Five propagated Moderate package entries remain from one [esbuild development-server advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99), through Void → drizzle-kit → @esbuild-kit. The archive contains no dependency code, but consumers install these peers. Do not automatically downgrade Void to npm audit's suggested old 0.1.6 or add an untested transitive override. Resolve the upstream tree, or review actual reachability and exposure before explicitly accepting the advisory. `dependencySecurityApproved` remains false and `approvedDependencyAdvisories` empty; both are checked by the plan.

Separately, isolated npm 11.21.0 publisher tooling produced five vulnerable package entries (High 3, Moderate 2), covering twelve distinct advisory URLs in bundled dependencies. It is not part of the adapter archive. The stage job audits publisher tooling and stops on Moderate or higher findings before upload. Select a remediated CLI with staged publishing/OIDC support and update `npmVersion` only after validation. Preparation does not claim an overall audit-zero result.

Source and history scans are evidence, not certification. Deleted evidence logs remain in Git history. Review the historical artifact paths before setting `historyDisclosureApproved` or making the repository public; any history rewrite needs a separate decision. The private repository stays unchanged.

## First package and trusted publishing

Owner identity, npm access and 2FA are not established by a dry run. Check name availability immediately before setup. [npm staged publishing](https://docs.npmjs.com/staged-publishing/) supports a first package: the owner can stage the accepted archive locally, review it and approve with personal 2FA. The owner can then configure a stage-only [trusted publisher](https://docs.npmjs.com/trusted-publishers/) for this repository, `.github/workflows/npm-stage.yml` and the `npm-stage` environment. Review current npm instructions at that time; unconfirmed new publisher configuration expires after two days.

Automated staging deliberately requires an existing package owned by `npmOwner`. It checks manual version-tag dispatch, main ancestry, protected environment reviewers, no admin bypass, public repository, CLI version, source commit, artifact digest and run/attempt before submitting the same archive. The workflow never performs final npm approval. Flags and repository variables remain disabled until separately authorized.

For the intended provenance path, approve public repository visibility and history disclosure first. npm [provenance requirements](https://docs.npmjs.com/generating-provenance-statements/) require a public source repository and public package. If the repository stays private, revisit the provenance policy explicitly.

Configure reviewers and self-review policy before enabling the environment. With `preventSelfReview: true`, the initiator needs a different reviewer. Then approve the candidate commit/version, create the matching `v0.1.0-alpha.0` tag, enable the stage path and re-run preparation. No tag, GitHub release, registry upload or visibility change is performed by preparation or planning.

After owner approval, verify registry version, `next` dist-tag, provenance and a fresh npm-installed consumer. A passing local archive or staged receipt alone is not public-release verification.
