# Security policy

Report suspected vulnerabilities privately through [GitHub's vulnerability reporting form](https://github.com/ts-76/void-plugin-hono-jsx/security/advisories/new). Private vulnerability reporting is enabled. Do not include credentials or exploit details in a public issue.

The maintainer reviews reports on a best-effort basis; no response-time SLA is promised. Include the affected package/framework versions, a minimal synthetic reproduction, impact and the relevant execution path.

## Supported versions

Security and bug fixes target the latest normal release series. The first planned series is 0.1.x; it has not been published yet. RCs receive fixes through the next candidate. Historical alpha releases and older normal series have no indefinite backport commitment. Upgrade to the latest supported release when one is available.

Within 0.1.x, patches preserve the documented public API. Breaking changes move to 0.2.0 or later and include migration notes. A normal 0.x release is not a claim of the SemVer 1.0 compatibility contract.

## Scope

Use the versioned [release contract](docs/release-contract.md). Repository-authored Markdown may contain raw HTML and must be trusted. Untrusted upload validation, authorization, CSRF protection and safe storage belong to the consuming application; multipart support does not implement those policies.

Runtime peers and publisher tooling are assessed separately. See [dependency findings](docs/dependency-security.md) and [the pnpm publisher assessment](docs/pnpm-publisher-assessment.md). Accepted findings are conditional, remain nonzero and do not cover newly reported advisories or other execution paths. Do not add transitive overrides to hide an audit report.
