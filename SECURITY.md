# Security policy

Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/ts-76/void-plugin-hono-jsx/security/advisories/new).
Include affected versions, a minimal synthetic reproduction and the impact.
Keep credentials and exploit details out of public issues.
Reports are reviewed on a best-effort basis; no response-time SLA is offered.

## Supported versions

Security and bug fixes target the latest normal release series, currently **0.2.x**.
Older normal series and historical alpha/RC versions have no guaranteed backports.
Upgrade to the latest supported release.

Patches preserve documented APIs within the supported minor series.
Breaking changes use a new minor while the package is below 1.0 and include migration notes.

## Scope

See the [support policy](docs/release-contract.md) and [known limitations](docs/known-limitations.md).
Markdown accepts trusted authored HTML without sanitization.
Applications remain responsible for authentication, authorization, CSRF protection, upload validation and storage.

Consumer dependencies and publisher tooling have separate assessments.
Known findings remain conditional and nonzero; they do not cover new advisories or other execution paths.
See the [dependency reassessment](docs/rc-security-assessment.md) and [publisher assessment](docs/pnpm-publisher-assessment.md).
