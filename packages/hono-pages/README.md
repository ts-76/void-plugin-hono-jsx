# Experimental Hono Pages adapter for Void

This private validation package integrates Hono JSX with Void Pages. The package name is `void-plugin-hono-jsx`. It is unpublished and unlicensed for redistribution until maintainers make the release decisions in Issue #12. It is not an official Void adapter.

## Supported versions

| Dependency | Verified version |
| --- | --- |
| Node.js | 24.21.0 or newer |
| Void | 0.26.0 |
| Hono | 4.13.13 |
| Vite | 8.3.3 |

Framework packages are exact peer dependencies. Other versions have not been validated; the plugin rejects an unverified Void version.

## Install the validation tarball

In the repository, run `npm ci`, `npm run build:package`, then `npm pack ./packages/hono-pages`. Install the resulting tarball in your project alongside the supported peer versions:

```sh
npm install ./void-plugin-hono-jsx-0.0.0.tgz hono@4.13.13
npm install --save-dev void@0.26.0 vite@8.3.3 typescript@7.0.2
```

## Configure

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoPages } from 'void-plugin-hono-jsx/plugin';

export default defineConfig({ plugins: [voidPlugin(), voidHonoPages()] });
```

Configure project settings in `void.config.ts` using `defineConfig` from `void/config`. Run Vite from that project's root. `voidHonoPages()` includes the Hono JSX transform, so do not register a separate transform. Configure charset, viewport and favicon through Void's `head` settings.

Use `jsx: "react-jsx"` and `jsxImportSource: "hono/jsx"` in TypeScript. The plugin chooses the server or DOM factory for application JSX; the plugin resolves package runtime exports using Vite's actual consumer environment. Cloudflare worker environments may enable the browser condition, so that condition alone cannot select the renderer.

## Runtime exports

```tsx
import { Link, useRouter, useShared, useParams, useErrors } from 'void-plugin-hono-jsx/pages';
import { useForm } from 'void-plugin-hono-jsx/form';
```

`Link` and `useRouter` use Void's shared navigation protocol. Ordinary GET visits reset page state; refresh preserves it. Root/nested/named layouts retain state while they remain in the active chain. Shared data, route params and field errors are available in SSR and browser components. `useForm` supports all mutation methods, named actions, validation, duplicate suppression and cancellation. Cancellation does not undo server writes.

Head resolution and escaping follow Void. The adapter synchronizes document attributes and inert script metadata; navigation does not execute newly inserted scripts. Raw `script.innerHTML` is authored content. Serialize dynamic JSON-LD and escape `<` before assigning it.

## Experimental limitations

The virtual renderer/client entries follow version-specific conventions observed in Void's official adapter rather than a documented third-party registration API. Browser mounting redraws the SSR page; DOM reuse is not guaranteed. Islands, deferred props, prerender/static output, ISR and page-file HMR still require the corresponding follow-up issues. Unsupported modes fail clearly. Package publication and repository visibility are separate maintainer decisions.

## Verification

`npm run check:consumer` packs the package, audits its file list, copies a fixture into a temporary directory, installs locked peer dependencies and the tarball, and checks types, development rendering, production build, preview rendering and browser interaction. The consumer uses only the documented package exports and does not import repository source files.

Repository: https://github.com/ts-76/void-hono-jsx-poc
