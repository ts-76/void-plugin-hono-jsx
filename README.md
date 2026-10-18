# void-plugin-hono-jsx

Hono JSX for [Void](https://void.cloud): server-rendered pages, client navigation, forms and islands. Void handles routing, loaders, actions and caching.

This is a community adapter, licensed under [MIT](LICENSE).

## Install

Use Node.js 24.21.0 or newer within Node 24.

```sh
npm install void-plugin-hono-jsx hono@4.13.13
npm install --save-dev void@1.1.11 vite@8.3.4 typescript@7.0.2
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
| Node.js | >=24.21.0 <25.0.0 | 24.21.0 |
| Void | >=1.1.11 <1.2.0 | 1.1.11 |
| Hono | >=4.13.13 <5.0.0 | 4.13.13 |
| Vite | >=8.0.16 <9.0.0 | 8.3.4 |

Vite Plus 1.3.0 is also tested with its matching core alias. See [launcher setup](packages/hono-pages/README.md#running-vite-and-launcher-diagnostics).
Ranges allow stable updates; the table lists the versions actually tested.

## Features

- SSR pages with loaders, actions and persistent layouts.
- Client navigation, prefetching and optional View Transitions.
- JSON and multipart forms, including island forms.
- Deferred page data with Hono `use()` and Suspense.
- Islands with load, visible, idle and media scheduling.
- Static output and optional [Markdown](docs/markdown.md) with code highlighting, copying, containers and themes.

Browser mounting redraws server-rendered content. Development edits reload the page and reset local state.
Production ISR and the managed Void platform are unverified. See [known limitations](docs/known-limitations.md).

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
