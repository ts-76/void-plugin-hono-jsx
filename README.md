# void-plugin-hono-jsx

0.7.0 retains known undici/Zod risks in the required Void/Cloudflare development and CLI tooling, including a reachable process-termination case. The owner accepted them for this release only; they are not fixed. See the [dependency acceptance and usage limits](docs/dependency-security.md).

Hono JSX for [Void](https://void.cloud): server-rendered pages, client navigation, forms and islands. Void handles routing, loaders, actions and caching.

This is a community adapter, licensed under [MIT](LICENSE).

## Install

Use Node.js 24.22.1 or newer within Node 24.

```sh
npm install void-plugin-hono-jsx hono@4.13.13
npm install --save-dev void@1.2.1 vite@8.3.4 typescript@7.0.2
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoJsx } from 'void-plugin-hono-jsx/plugin';

export default defineConfig({
  plugins: [voidPlugin(), voidHonoJsx()],
});
```

Set these options in your TypeScript configuration:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  }
}
```

Run Vite from the project root. Keep Void settings in `void.config.ts`.
For an existing scaffold, follow the [setup guide](packages/hono-pages/README.md#adapting-a-void-scaffold).

## Compatibility

| Dependency | Supported stable range | Tested version |
| --- | --- | --- |
| Node.js | >=24.22.1 <25.0.0 | 24.22.1 |
| Void | >=1.2.1 <1.3.0 | 1.2.1 |
| Hono | >=4.13.13 <5.0.0 | 4.13.13 |
| Vite | >=8.0.16 <9.0.0 | 8.3.4 |

Vite Plus 1.3.0 is also tested with its matching core alias. See [launcher setup](packages/hono-pages/README.md#running-vite-and-launcher-diagnostics).
Ranges allow stable updates; the table lists the versions actually tested. Void 1.2.1 is the minimum: navigation and refresh use its corrected history/hash protocol.

## Features

- SSR pages with loaders, actions and persistent layouts.
- Client navigation, prefetching and optional View Transitions.
- JSON and multipart forms, including island forms.
- Deferred page data with Hono `use()` and Suspense.
- Islands with load, visible, idle and media scheduling.
- Static output and optional [Markdown](docs/markdown.md) with code highlighting, copying, containers and themes.

Browser mounting redraws server-rendered content. Development edits reload the page and reset local state.
Direct Workers ISR has a dated verification with an unresolved query-purge limitation. The managed Void platform remains unverified. See [known limitations](docs/known-limitations.md).

## Documentation

- [Setup and package exports](packages/hono-pages/README.md)
- [Pages, navigation, forms and islands](docs/pages.md)
- [Markdown](docs/markdown.md)
- [Examples and testing](docs/testing.md)
- [Roadmap](docs/stable-roadmap.md)
- [Contributing](CONTRIBUTING.md)

## Development

```sh
npm ci
npm run dev
```

The Pages example includes Markdown at `/markdown`. A minimal Custom SSR example is available with `npm run dev:custom-ssr`.

Report bugs through [GitHub Issues](https://github.com/ts-76/void-plugin-hono-jsx/issues).
Report vulnerabilities [privately](https://github.com/ts-76/void-plugin-hono-jsx/security/advisories/new); see the [security policy](SECURITY.md).

## Shared Hono Markdown and host boundaries

`packages/hono-markdown` contains the independent `@ts-76/hono-markdown` package:
compiler, literal component parsing, metadata context/hooks, CSS and DOM island
scheduling. It has no Void or Vite dependency. Accepted release checks install the published common dependency; local
development checks may select a candidate tarball alongside the adapter.
The adapter requires `@ts-76/hono-markdown@^0.2.0` so installations cannot retain
older compilers without the fence-range and island-attribute security fixes.

The Void plugin owns page discovery, layouts, head, loaders, virtual modules and
Void's scheduler. Existing `/markdown`, `/markdown/compiler`, `/markdown/client`
and theme imports remain supported. The old and common imports share the same
Markdown context, avoiding duplicate providers when documents and decks coexist.
The client entry only supplies Void's scheduler. Hosts supply a `ready` gate
for presentation-specific activation; the adapter does not inspect slide DOM.

Maintainer `npm install`, `npm run typecheck`, and `npm test` automatically build
the common package. `npm run build:package` builds both packages.
`npm run check:consumer` first verifies the independent package, then installs
both candidates and runs the existing real-app checks. Run
`node scripts/check-independent-markdown-consumer.mjs` to verify Markdown SSR in
a fresh consumer without Void or Vite installed. Local development checks can supply `HONO_MARKDOWN_PACKAGE`.
Accepted release artifacts always install the published common dependency;
local dependency substitutions are rejected for release evidence.

Release the common package before an adapter version that depends on it. The
existing adapter release gate still checks the exact artifact and permits only
the documented common dependency; it does not publish the new package implicitly.

The legacy theme exports retain their existing CSS snapshot and source files.
They do not automatically copy changes from the common theme. This preserves
existing styling while the new common theme can evolve independently.
