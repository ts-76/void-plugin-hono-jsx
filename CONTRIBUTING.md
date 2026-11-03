# Contributing

Bug reports, fixes and documentation improvements are welcome. The project is licensed under [MIT](LICENSE).

## Setup

Use Node.js >=24.22.1 <25.0.0 and the repository lockfile:

```sh
npm ci
npm run dev
```

Run `npm run check:source`, `npm run fmt:check`, `npm run typecheck`, `npm test`, and `npm run check:consumer`. Packed consumers require Playwright Chromium (`npx playwright install chromium`).
Run checks sequentially when they share example build output.

Format maintained code with the pinned Oxc formatter, Oxfmt:

```sh
npm run fmt
npm run fmt:check
```

The package CI checks formatting during `release:prepare`. `.oxfmtrc.json` defines
the shared style and exclusions. Markdown documents and fixture content, dependency
locks, publisher security inventories and the adapter's legacy theme snapshot are
excluded so formatting does not rewrite authored syntax or recorded release bytes.

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

## Release checks

Release Please manages versions and changelog. `npm run release:prepare` verifies the exact candidate, locked consumers and publisher; `npm run release:plan` reports remaining gates. Keep `release-policy.json`, audit inventories and publisher checks authoritative. A successful PR check is separate from release approval. The current Void/Cloudflare findings keep publication on hold; do not renew historical acceptance or relax audit gates during cleanup.
