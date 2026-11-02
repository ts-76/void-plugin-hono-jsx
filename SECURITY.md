# Security policy

Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/ts-76/void-plugin-hono-jsx/security/advisories/new).
Include affected versions, a minimal synthetic reproduction and the impact.
Keep credentials and exploit details out of public issues.
Reports are reviewed on a best-effort basis; no response-time SLA is offered.

## Supported versions

Security and bug fixes target the latest normal release series, currently **0.9.x**.
Older normal series and historical alpha/RC versions have no guaranteed backports.
Upgrade to the latest supported release.

Patches preserve documented APIs within the supported minor series.
Breaking changes use a new minor while the package is below 1.0 and include migration notes.

## Scope

See the compatibility table in [README](README.md#compatibility) and the package runtime limits.
Markdown accepts trusted authored HTML without sanitization.
Applications remain responsible for authentication, authorization, CSRF protection, upload validation and storage.

Consumer dependencies and publisher tooling have separate assessments.
Known findings remain conditional and nonzero; they do not cover new advisories or other execution paths.
The 2026-11-03 candidate validates Void 1.5.0 and has 5 propagated audit entries (0 High, 5 Moderate) from one advisory in esbuild 0.18.20 through Drizzle Kit. Compatible upstream Cloudflare updates clear the previously recorded undici, Zod and minimatch findings; the inspected cf distribution embeds undici 7.30.1. These counts describe the dependency inventory, not demonstrated exposure in every application. Publication is on hold pending upstream fixes. Historical acceptance for 0.9.1 applies only to its original Node/peer/lock/advisory bindings and does not cover the current graph.

Keep development/preview private, use trusted project configuration, bound external inputs, and do not use the affected esbuild serve feature. Worker-native fetch and application-defined handlers need their own assessment.

Publisher tooling has a separate zero-finding gate. Its pinned compatibility exception and verification are in [scripts/release/PUBLISHER.md](scripts/release/PUBLISHER.md); this does not repair consumer dependencies. `release-policy.json`, exact inventories, hashes and fresh audit checks remain mandatory. Cleanup does not add risk acceptance or permit publication.
