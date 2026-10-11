# Changelog

## [0.1.0-alpha.1](https://github.com/ts-76/void-plugin-hono-jsx/compare/v0.1.0-alpha.0...v0.1.0-alpha.1) (2026-10-11)


### Documentation

* record real OIDC alpha stage and verification limits ([#37](https://github.com/ts-76/void-plugin-hono-jsx/issues/37)) ([f3eeb0d](https://github.com/ts-76/void-plugin-hono-jsx/commit/f3eeb0d06ff11462e2af49a373dedb8c998b15e3))
* verify published alpha provenance and registry installation ([#38](https://github.com/ts-76/void-plugin-hono-jsx/issues/38)) ([70cadfe](https://github.com/ts-76/void-plugin-hono-jsx/commit/70cadfe3e88744db493c435b9dbc2ffefb52dc65))


### Release Automation

* manage alpha releases with release-please ([#39](https://github.com/ts-76/void-plugin-hono-jsx/issues/39)) ([3528b90](https://github.com/ts-76/void-plugin-hono-jsx/commit/3528b90d4222c8eb9709fbd5cce7e94ae6c4f0f8))
* validate component release branches before dispatching checks ([#41](https://github.com/ts-76/void-plugin-hono-jsx/issues/41)) ([64b2abb](https://github.com/ts-76/void-plugin-hono-jsx/commit/64b2abb8fae76bdbc0afd9683aba2e2f8c2cd188))

## 0.1.0-alpha.0 (2026-10-12)

- Accept the upstream esbuild development-server advisory GHSA-67mh-4wv8-2f99 as a documented limitation of the pinned alpha baseline, without dependency overrides. New unreviewed advisories and publisher-tooling findings remain blocked by the release gates.
- Verify Void 0.26.1 production deferred errors remain generic while development preserves diagnostic messages.
- Record the macOS development transport limitation after an undefined-action POST; the adapter does not repair this upstream edge case.

Initial experimental Hono JSX Pages adapter for Void 0.26.1.

- Server-rendered Pages, client-only pages, Void navigation and persistent layouts.
- Loader/action forms, head metadata and single deferred loader props.
- Load-policy islands, static output, development document reload and local ISR.
- Exact framework peers: Hono 4.13.13, Void 0.26.1 and Vite 8.3.3; Node >=24.21.0.

Browser mounting redraws server content. Managed edge deployment is unverified.
See the package guide for unsupported modes and the pinned compatibility policy.
Published on npm with the `next` tag after maintainer approval. Public bytes and provenance are recorded in `docs/stage-validation-result.md`.
