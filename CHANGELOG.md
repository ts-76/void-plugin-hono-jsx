# Changelog

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
