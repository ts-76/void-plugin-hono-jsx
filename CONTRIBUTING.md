# Contributing

Bug reports, fixes and documentation improvements are welcome. The project is licensed under [MIT](LICENSE).

## Setup

Use Node.js >=24.21.0 <25.0.0 and the repository lockfile:

```sh
npm ci
npm run dev
```

See [testing](docs/testing.md) for examples, check commands and browser setup.
Run checks sequentially when they share example build output.

## Changes

Keep routing, request protocols, caching and build lifecycle in Void.
Framework upgrades need locked consumer checks and a documented support decision.
Add behavioral coverage for substantive changes and test the packed artifact.

Use Conventional Commit PR titles, such as `feat:`, `fix:`, `docs:` or `ci:`.
Mark breaking changes with `!` and include migration instructions.
Release Please manages versions and changelog; do not bump individual manifests manually.
Changes are grouped for release. A merged PR does not publish to npm.

In the PR, describe the resulting behavior, checks actually run and any remaining limitations.
Keep generated logs, screenshots, caches and tarballs out of Git.

## Bug reports

Include:

- Node, Void, Hono, Vite and adapter versions.
- A minimal reproduction and relevant configuration.
- Expected and actual behavior.
- Whether the failure occurs in dev, preview or static output.

Remove credentials, private URLs, personal paths and application data from reports.
Report vulnerabilities [privately](https://github.com/ts-76/void-plugin-hono-jsx/security/advisories/new), following [SECURITY.md](SECURITY.md).

## Maintainer references

- [Architecture](docs/architecture.md)
- [Supported behavior](docs/release-contract.md)
- [Release automation](docs/release-please.md)
- [Release checklist](docs/release-checklist.md)
