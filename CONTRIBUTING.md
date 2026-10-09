# Contributing

This adapter is experimental and unpublished. The project uses the [MIT license](LICENSE). Follow the release checklist before publishing a release.

## Setup and checks

Use Node.js 24.21.0 or newer and the repository lockfile:

```sh
npm ci
npm run typecheck
npm test
npm run build:pages
npx playwright install chromium
npm run check:consumer
npm run audit:release
```

For installed Google Chrome, run `PLAYWRIGHT_CHANNEL=chrome npm run check:consumer`. The consumer check builds and packs the adapter, installs it in an isolated locked fixture, starts local servers, runs browser checks and stops its own servers. It does not deploy cloud resources. `KEEP_CONSUMER_FIXTURE=1` retains that fixture for debugging; remove it when finished.

The examples and check runner disable Wrangler metrics and external `Request.cf` discovery. For manual source-example runs, set the environment variables documented in [implementation notes](docs/implementation-notes.md), then run `npm run dev:pages` or `npm run preview:pages` after building.

## Changes

Keep Void responsible for its routing, request protocol, caching and build lifecycle. Change the adapter only at the renderer/runtime boundary. A framework-version change needs the locked clean-consumer checks and a documented compatibility decision. Do not widen peer ranges based on types alone.

Add behavioral coverage for substantive changes. Check the packed artifact rather than relying only on imports from repository source. Describe the observed behavior, verification command and remaining limitations in the PR. Draft PRs are useful for incomplete framework work; do not claim completion while required checks remain pending.

## Bug reports

Include exact Node/Void/Hono/Vite versions, configuration, a minimal reproduction, expected and actual behavior, and whether the failure occurs in development, preview or generated static output. Remove tokens, private URLs, personal paths and real application data from logs. Use synthetic values for serialization regressions.

Do not post credentials or private data in a public issue. For sensitive findings, use a private maintainer contact once one is documented. No private reporting channel is configured yet.

## Release changes

Package publication, repository visibility and npm ownership are maintainer decisions. Contributors can prepare artifacts and evidence; they must not infer publication approval from a merged code change. Follow the [release checklist](docs/release-checklist.md).

The source browser checks can use dedicated servers with `VOID_HONO_DEV_PORT`, `VOID_HONO_PREVIEW_PORT` and `VOID_HONO_BROWSER_SESSION`. Start the matching development and preview servers and Chrome session first. Defaults are 5174, 4174 and `void-hono-pages`. Run checks sequentially when they share fixture state.
