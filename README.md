# void-plugin-hono-jsx

Hono JSX for [Void](https://void.cloud): server-rendered pages, client navigation, forms and islands. Void handles routing, loaders, actions and caching.

This is a community adapter, licensed under [MIT](LICENSE).

## Install

Use Node.js 24.22.1 or newer within Node 24.

```sh
npm install void-plugin-hono-jsx hono@4.13.16
npm install --save-dev void@1.10.0 vite@8.3.5 typescript@7.0.2
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
For an existing scaffold, follow the [setup guide](packages/void-plugin-hono-jsx/README.md#adapting-a-void-scaffold).

## Compatibility

| Dependency | Supported stable range | Tested version |
| --- | --- | --- |
| Node.js | >=24.22.1 <25.0.0 | 24.22.1 |
| Void | >=1.6.2 <1.11.0 | 1.10.0 |
| Hono | >=4.13.16 <5.0.0 | 4.13.16 |
| Vite | >=8.0.16 <9.0.0 | 8.3.5 |

Vite Plus 1.4.0 is also tested with its matching core alias. See [launcher setup](packages/void-plugin-hono-jsx/README.md#running-vite-and-launcher-diagnostics).
Ranges allow stable updates; the table lists the versions actually tested. Void 1.10.0 is the validated version; navigation, actions and the Cloudflare integration are checked against its current protocol. Void 1.6.2 was validated with adapter 0.11.0.
Versions outside these ranges print a warning at startup and are not blocked; they may not work.

## Features

- SSR pages with loaders, actions and persistent layouts.
- Client navigation, prefetching and optional View Transitions.
- JSON and multipart forms, including island forms.
- Deferred page data with Hono `use()` and Suspense.
- Islands with load, visible, idle and media scheduling.
- Static output and optional [Markdown](packages/void-plugin-hono-jsx/README.md#optional-markdown) with code highlighting, copying, containers and themes.

Browser mounting redraws server-rendered content. Editing an island component in development re-renders its islands without a page reload, resetting their state; other development edits reload the page.
Direct Workers ISR has a dated verification with an unresolved query-purge limitation. The managed Void platform remains unverified. See [runtime limits](packages/void-plugin-hono-jsx/README.md#compatibility-and-rendering-limits).

## Usage

See [setup and package exports](packages/void-plugin-hono-jsx/README.md), the runnable [Pages example](examples/pages), and [contributing](CONTRIBUTING.md).

## Development

```sh
npm ci
npm run dev
```

The Pages example includes Markdown at `/markdown`. A minimal Custom SSR example is available with `npm run dev:custom-ssr`.

Report bugs through [GitHub Issues](https://github.com/ts-76/void-plugin-hono-jsx/issues).
Report vulnerabilities [privately](https://github.com/ts-76/void-plugin-hono-jsx/security/advisories/new); see the [security policy](SECURITY.md).

## Repository layout

- `packages/void-plugin-hono-jsx`: the adapter published as `void-plugin-hono-jsx`.
- `packages/hono-markdown`: `@ts-76/hono-markdown`, the Markdown compiler and runtime with no Void or Vite dependency.
  The adapter loads it only for Markdown, as an optional peer.

Maintainer checks for the shared package are described in [CONTRIBUTING](CONTRIBUTING.md#shared-markdown-package).
