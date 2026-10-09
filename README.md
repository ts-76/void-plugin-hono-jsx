# Void × Hono JSX 最小 PoC

Void の Custom SSR で `hono/jsx` の HTML を返し、ブラウザーでは `hono/jsx/dom` でカウンターを描画する検証用プロジェクトです。クラウドへのデプロイ・認証は不要です。

**2026-10-09 に、型チェック・本番ビルド・開発と本番プレビューでの Chrome 操作を確認しました。** SSR で初期 HTML を返し、ブラウザーでカウンターを操作する最小 PoC の検証は完了しています。

## 使用版

2026-10-08 の npm registry 確認時点で最新の `void` と `hono` を使用しました。再現には `package-lock.json` を使ってください。

| 項目 | 使用版 |
| --- | --- |
| Node.js | 24.21.0 |
| npm | 初回 10.8.1 / 再検証 11.19.0 |
| Void | 0.26.0 |
| Hono | 4.13.13 |
| Vite | 8.3.3 |
| TypeScript | 7.0.2 |

Void 0.26.0 の engines は Node.js `>=24.21.0`、peerDependencies は Vite `^8.0.0` です。初回環境の Node.js 22.0.0 と再検証した Mac の 24.20.0 は要件を満たさなかったため、`.runtime` に Node.js 24.21.0 を用意しました。このディレクトリは Git に含めていません。

## 再現手順

Node.js 24.21.0 以上を用意し、プロジェクトのルートで実行します。

```sh
node --version
npm ci
npm run typecheck
```

macOS / Linux では、次の設定で起動できます。Wrangler のログをプロジェクト内に保存し、ローカルデバッガーのポートを無効にします。`CLOUDFLARE_CF_FETCH_ENABLED=false` は、Miniflare が位置情報などの `Request.cf` 情報を外部から取得する処理を無効にし、ローカルの既定値を使う設定です。この PoC は `Request.cf` を参照しないため、外部取得は不要です。

```sh
mkdir -p .void/logs
export WRANGLER_LOG_PATH="$PWD/.void/logs"
export WRANGLER_SEND_METRICS=false
export VOID_INSPECTOR_PORT=false
export CLOUDFLARE_CF_FETCH_ENABLED=false
npm run dev
```

開発ページ: http://127.0.0.1:5173/

別の端末で同じ環境変数を設定し、本番ビルドとローカルプレビューを実行します。

```sh
export WRANGLER_LOG_PATH="$PWD/.void/logs"
export WRANGLER_SEND_METRICS=false
export VOID_INSPECTOR_PORT=false
export CLOUDFLARE_CF_FETCH_ENABLED=false
npm run build
npm run preview
```

本番プレビュー: http://127.0.0.1:4173/

`void init` や `void deploy` は必要ありません。Cloudflare のローカル Workers runtime を使います。ホスティングへのデプロイは検証していません。

## 構成とプラグインの役割

- `src/main.ssr.tsx`: `defineRender` から Response を返します。Hono JSX の `toString()` で HTML を作り、Void の `assetTags.css` / `preloads` / `body` を `hono/html` の `raw` で挿入します。`/` のみを表示し、それ以外は 404 を返します。
- `src/main.client.tsx`: SSR が渡した `data-initial-count` を読み、`render` でカウンター領域を描画します。
- `src/Counter.tsx`: SSR とブラウザーで共有するカウンター。`useState` は `hono/jsx` の共有 hook を使います。
- `plugins/hono-jsx.ts`: Vite の pre-transform でアプリの TSX / JSX を Oxc に渡します。環境の `consumer` が `client` なら `hono/jsx/dom`、サーバーなら `hono/jsx` を automatic JSX runtime に設定します。開発時は JSX の development 変換を使います。
- `vite.config.ts`: 自作プラグインと `voidPlugin()` を合成します。`voidPlugin()` は Vite プラグイン配列を返します。
- `void.lock.json`: Void が解決したローカル Workers 設定を記録します。

Vite 8 の `EnvironmentOptions` は `oxc` を持たないため、この PoC は環境ごとの `configEnvironment` で Oxc を設定せず、`transform` 内で環境を判定します。TypeScript の既定 JSX 型は `hono/jsx` とし、クライアント entry には DOM 用 `@jsxImportSource` を指定しています。

`hono-jsx` プラグインが担うのは JSX 変換だけです。後続の Issue #1 で、別の実験用 Pages アダプターと loader 付きの例を追加しました。対応範囲と使い方は末尾の「Experimental Void Pages adapter」を参照してください。

## Hydration と公式 API の確認

Hono 4.13.13 では `hono/jsx/dom` が `render` を公開しています。`hydrateRoot` は `hono/jsx/dom/client` にあり、実装に hydrate は render 相当と記載されています。この PoC は `render` を使い、SSR が作ったカウンター領域をブラウザーで描き直します。React のような既存 DOM 再利用型 hydration と同じ保証はしません。

Void の Custom SSR entry 名、`defineRender`、assetTags、`voidPlugin()` の戻り値は確認した資料と一致しました。Hono の公式 Void 統合ガイドは middleware / helper の使用を説明していますが、Hono JSX の Pages アダプターとしての対応を保証する記述は確認していません。実験用 Pages アダプターでは公式 React アダプターの接続方法を確認して使用していますが、独自アダプター用の安定した公開登録 API として保証されたものではありません。

## 2026-10-09 の検証結果

| 確認 | 結果 |
| --- | --- |
| lockfile から依存を取得 | `npm ci` 成功 |
| 型チェック | Node.js 24.21.0 で `typecheck` 成功。終了コード 0、診断なし |
| 本番ビルド | `dist/ssr` と `dist/client` を生成。ログ保存先を指定して終了コード 0、権限エラーなし |
| 開発・本番プレビューの SSR | 両方 HTTP 200、`x-poc-renderer: hono/jsx`。初期 HTML に SSR の文章、カウンター 0、クライアント起動前の表示、client entry の script を確認 |
| 開発時の Counter JSX 変換 | `hono/jsx/dom/jsx-dev-runtime` への import を確認 |
| Chrome でのクライアント起動 | 両方に「クライアント起動済み: hono/jsx/dom」と表示 |
| 連続クリック | 両方で `+1` を押し、1 → 2 → 3 と増えることを確認 |
| リセット・再読み込み | 両方でリセットすると 0。再び増やして再読み込みすると 0 |
| エラー確認 | 最終確認で両方の browser console、page errors、サーバーログに実行エラーなし |
| 存在しない URL | 両方で `/missing` が HTTP 404 |

再検証では agent-browser から、Mac にインストール済みの Google Chrome を headless で操作しました。初回のブラウザー接続停止は、この方法で解消しています。

検証中、favicon の自動取得で console に 404 が出たため、SSR の head に空の data URL のアイコンを指定しました。また、Miniflare の `Request.cf` 外部取得がタイムアウトしたため、上記の環境変数を追加しました。修正後に再ビルド・再起動し、両方の表示、カウンター操作、再読み込み、エラー解消を再確認しています。

この Mac の `evidence/` に install / typecheck / dev / build / preview のログ、SSR HTML、レスポンスヘッダー、開発時変換コード、`dev.png` と `preview.png` を保存しています。マシン固有の絶対パスや runtime 情報を含むため、Git には含めていません。

## 検証の範囲と今後の候補

今回確認したのは、Custom SSR と DOM カウンターを組み合わせる最小構成です。クラウドへのデプロイ、複数ブラウザー、状態維持 HMR、SSR DOM の再利用は検証していません。独立した DOM 単体テストも追加していません。

今後、用途に応じて複数ページ、loaders / actions、layouts、islands などを検討できます。Void の Pages アダプター対応を進める場合は、まず公開登録 API を確認する必要があります。

## 参考にした公式資料

- [Void Quickstart](https://void.cloud/guide/quickstart)
- [Void Plugin API](https://void.cloud/reference/api/plugin)
- [Void Custom SSR](https://void.cloud/guide/ssr)
- [Void Hono integration](https://void.cloud/integrations/hono)
- [Void Pages Routing](https://void.cloud/guide/pages-routing/overview)
- [Hono Client Components](https://hono.dev/docs/guides/jsx-dom)
- [Vite Plugin API](https://vite.dev/guide/api-plugin)

## Experimental Void Pages adapter

[Issue #1](https://github.com/ts-76/void-hono-jsx-poc/issues/1) introduces a separate Pages smoke example. The original Custom SSR example remains available through `npm run dev`, `npm run build`, and `npm run preview`.

The Pages example uses Void's scanner and loader pipeline, Hono JSX for server rendering, and Hono DOM for browser mounting. Its loader returns an initial counter value of **7**, so the example verifies actual server-to-client props rather than a hard-coded browser default. Reset and reload restore that loader value.

With Node.js 24.21.0 or newer and dependencies installed at the repository root:

```sh
mkdir -p .void/logs
export WRANGLER_LOG_PATH="$PWD/.void/logs"
export WRANGLER_SEND_METRICS=false
export VOID_INSPECTOR_PORT=false
export CLOUDFLARE_CF_FETCH_ENABLED=false
npm run typecheck
npm test
npm run dev:pages
```

The development example is served at http://127.0.0.1:5174/. In another terminal, set the same environment variables and run:

```sh
npm run build:pages
npm run preview:pages
```

The production preview is served at http://127.0.0.1:4174/. With both servers running, verify the HTTP contract:

```sh
node scripts/check-pages-smoke.mjs http://127.0.0.1:5174
node scripts/check-pages-smoke.mjs http://127.0.0.1:4174
```

The example configuration composes `voidPlugin()` with `voidHonoPages()`. The latter includes the JSX transform; do not register `honoJsx()` again. Run Vite from the example's working directory, as the provided scripts do, so both Void and the adapter resolve the same project root.

### Integration contract

The contract was checked against installed Void **0.26.0** and the published **@void/react 0.26.0** adapter. Hono **4.13.13** and Vite **8.3.3** are the tested baseline.

| Interface | Status and use |
| --- | --- |
| `void/pages`: `resolvePagesDir`, `scanPages`, `generateComponentManifest` | Exported package APIs used by the Vite plugin to reuse Void's page discovery and component IDs. |
| `void/pages-protocol`: `PageObject` | Exported payload type. The renderer receives the component ID, loader props, route data, and resolved head from Void. |
| `void/pages-server`: `serializePageData` | Exported runtime serializer used to embed the payload safely in an application/json script. |
| `void/pages-head`: rendering helpers | Exported runtime helpers used for initial head and document attributes. Void owns client-side title/meta/link updates; the adapter also synchronizes document attributes and inert script tags. |
| `virtual:void-pages-renderer`: `renderPage(pageObj, assetTags)` | A version-specific virtual-module convention consumed by Void and provided by official adapters. It is not a documented third-party registration API. |
| `virtual:void-pages-client` and `pages-client` build input | Version-specific client-entry conventions copied in behavior from the official adapter. The generated entry mounts the page using serialized loader props. |
| `__VOID_PAGE_DATA__` and `#app` | Initial payload and mount-element conventions shared with the official adapter's SSR output. |

The plugin rejects unverified Void versions. A successful smoke test establishes this pinned experimental integration; it does not establish an upstream-supported Hono Pages adapter or compatibility with every future Void release. Build-time discovery helpers are kept out of runtime imports by using the dedicated serializer and head exports.

### Supported behavior and limitations

The example supports initial SSR of TSX/JSX pages with loader props, file-based routes, client-only pages, browser mounting, local interaction, SPA navigation, and full-document reloads. Browser mounting redraws the page; reuse of the existing SSR DOM is not guaranteed.

Load-policy island pages are supported. Island layouts, explicit prerendering, and static output are rejected with diagnostics. Single deferred props use Void streaming and Hono loading/value/error state. Page-file discovery during HMR is not implemented. Head behavior is covered by the dedicated SSR and navigation checks. Follow-up work is tracked in [Issues #3 through #13](https://github.com/ts-76/void-hono-jsx-poc/issues).

The loader deliberately includes a string containing closing script tags, an ampersand, and Unicode line separators. The HTTP check verifies safe JSON embedding and an exact props round trip. Browser checks additionally confirm that the string remains text and never executes.

On 2026-10-09, type checking, six scanner/diagnostic tests, production build, and HTTP checks passed. Chrome checks passed in both development and production preview: counter **7 → 8 → 9 → 10**, reset to **7**, reload to **7**, matching loader text, no injected script execution, and no page or console errors.

The repository remains private and the package remains unpublished. Package distribution and OSS release decisions are tracked separately in Issues #7 and #12.

### File-based routes and client-only pages

[Issue #2](https://github.com/ts-76/void-hono-jsx-poc/issues/2) adds examples using Void's existing route discovery and request protocol.

| URL | Behavior |
| --- | --- |
| `/about` | Static page. |
| `/users/alice` | Dynamic page. Its loader reads `id` and displays `alice`. |
| `/docs/guide/start` | Catch-all page. Its loader reads `slug` and displays `guide/start`. |
| `/contact` | Grouped page. The route group does not appear in the URL. |
| `/browser` | Client-only page. Void runs the loader and sends an empty app shell with initial count 11. |

The client-only component accesses `window` at module scope. A successful HTTP response proves that the server does not evaluate that module. The generated client entry reads the loader payload and mounts it normally. Setting `ssr = false` in a companion server module uses Void's own shell renderer.

Run these checks with the development and production-preview servers active:

```sh
node scripts/check-pages-routing.mjs http://127.0.0.1:5174
node scripts/check-pages-routing.mjs http://127.0.0.1:4174 --check-build
```

HTTP checks compare SSR output with Void's `X-VoidPages` JSON response for each route. The build check confirms that a server-only sentinel exists in the server bundle and is absent from client assets. It never returns that sentinel as page props.

Chrome checks on 2026-10-09 passed for all six route requests in both development and production preview. Each page mounts, accepts a counter click, and resets on reload. Client-only markup appears only after mounting. Type checking, six scanner/diagnostic tests, production build, HTTP checks, and server-only bundle isolation also passed.

### Navigation

[Issue #3](https://github.com/ts-76/void-hono-jsx-poc/issues/3) connects Hono rendering to `createVoidRouter` from `void/pages-client`. Void owns page requests, cancellation, history, and scroll handling. Import `Link` and `useRouter` from `runtime/pages` in this repository's examples:

```tsx
const router = useRouter();
<Link href="/users/alice?tab=profile">Alice</Link>
<button onClick={() => void router.refresh()}>Refresh</button>
```

`Link` handles primary, unmodified clicks on same-origin HTTP links. Modified clicks, downloads, external links, other targets, and `reloadDocument` keep native anchor behavior. Ordinary GET visits reset page state. Void's `refresh()` preserves page state by default. The root's `data-navigation` attribute reports `idle`, `loading`, or `submitting`.

A rejected link visit shows an accessible error message and keeps the current page available. HTTP responses without the Pages protocol and failed network requests follow Void's full-document fallback. Callers of `router.visit()` and `router.refresh()` should handle rejected promises themselves.

Chrome checks on 2026-10-09 passed in development and production preview: loader props and query strings updated without document reload; back/forward and hash navigation worked; refresh preserved the counter; a newer visit cancelled a slow request; an invalid JSON response cleared pending state and allowed recovery; navigation into a client-only page worked. Native-link checks and an explicit document reload also passed. See `evidence/pages-navigation-browser.log` for the recorded checks. To repeat the browser checks with Python 3, agent-browser 0.19.0, and Google Chrome on macOS, start both servers and run:

```sh
agent-browser --session void-hono-pages --executable-path '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' open http://127.0.0.1:5174
python3 scripts/check-pages-navigation.py
```

The checks use the example's deliberate slow and failing routes. They inject one malformed Pages response to verify error recovery without depending on Void's development error overlay.

### Layouts and shared data

The adapter consumes Void's resolved layout chain for SSR and browser rendering. `layout.tsx` files wrap their descendants. A page's `export const layout = "shell"` selects the nearest `_layouts/shell.tsx` and replaces the innermost default layout. `"!shell"` selects only the named layout; `false` removes the chain. Island layouts remain unsupported.

Layouts receive `children`. Stable layout IDs preserve state in the surviving chain while ordinary page visits reset page state. Leaving a layout unmounts it, so returning starts fresh. Changing an outer layout also replaces its descendants.

`useShared()` and `useParams()` from `runtime/pages` expose the current PageObject data in both SSR and browser components. Shared values have type `Record<string, unknown>`; consumers should validate values before using them. The example's middleware supplies a tenant and request path. Each completed visit updates that data for the page and every active layout.

Visit `/layouts/one` to test the root and nested counters. `/layouts/two` retains them, `/layouts/named` replaces the nested layout, `/layouts/exclusive` removes the root, and `/layouts/bare` removes all layouts. Run `python3 scripts/check-pages-layouts.py` with both servers and the documented Chrome session active. On 2026-10-09, SSR ordering, layout state, page resets, unmount/remount, named layout modes, shared data, and route parameters passed in development and production preview.

### Forms and actions

`useForm(initialData)` from `runtime/form` wraps Void's `submitAction` protocol. It provides `data`, `setData`, field `errors`, an action `error`, `pending`, `wasSuccessful`, `reset`, `cancel`, and `post`, `put`, `patch`, and `delete` methods. Pass a URL such as `/named?save` for a named action. Successful actions use Void's refreshed loader payload or follow its redirect. `useErrors()` exposes the current PageObject errors to other components.

Input stays in the form after validation failure. Editing clears errors and success state; each submission clears the previous result. A synchronous guard ignores duplicate submissions while a request is active. Cancellation supersedes the visit with a state-preserving refresh and releases the form's pending state. It does not undo a mutation already performed on the server.

Use `ValidationError` from `void/handler` for manual field validation or Void's Standard Schema validators. Void processes a 400 validator response's `issues` structure; an arbitrary `{ errors }` 400 response does not have the same meaning. Unexpected action failures remain available as `Error` objects, including `VoidActionError` status and response data where applicable.

The `/edit` and `/named` fixtures use in-memory worker state for demonstration, which resets with the worker and is not a persistent datastore. The named example includes deliberate failure, delayed save, and redirect actions. Void preserves the originating query string on the demonstrated redirect.

With both servers active, run the HTTP and browser checks sequentially because they mutate the same example state:

```sh
node scripts/check-pages-actions.mjs http://127.0.0.1:5174
node scripts/check-pages-actions.mjs http://127.0.0.1:4174 --check-build
python3 scripts/check-pages-actions.py
```

The browser check requires the documented Chrome session. It covers successful edits, validation with input retention, named actions, redirects, errors, pending/success state, duplicate suppression, and cancellation in development and production preview.

### Head metadata

Use Void's `head` configuration, middleware `headDefaults`, and page `defineHead()` functions. Void resolves precedence and serializes head content. The adapter renders that descriptor during SSR; it adds no implicit title, meta, or favicon tags. Configure document defaults such as charset, viewport, and favicon in Void's project head settings.

Void's shared router updates title/meta/link tags at navigation commit. The adapter synchronizes owned HTML/body attributes, removes destination-stale attributes, and keeps declarative script tags consistent. Unchanged scripts retain their nodes. New navigation script tags are parsed as inert markup and do not execute; executable scripts follow normal browser behavior on full-document loading. Third-party script lifecycle management remains outside this adapter.

`script.innerHTML` follows Void's raw-content semantics. For JSON-LD containing dynamic values, serialize JSON and replace `<` with `\\u003c` before assigning it, as the example does. Title, meta content, and attribute values use Void's escaping helpers.

Visit `/head/one` and `/head/two` to compare metadata. Project defaults and middleware data coexist with page-derived values. `python3 scripts/check-pages-head.py` checks direct requests, SPA visits, back/forward, refresh, precedence, stale tag/attribute removal, duplicate prevention, script preservation and inert reinsertion, and escaped dynamic values in both development and production preview.

### Installable adapter package

The package name is `void-plugin-hono-jsx`. Build and validate it with the supported Node version:

```sh
npm ci
npm run check:consumer
```

The check packs only ESM code, declarations and documentation, installs the tarball in an isolated locked consumer, then verifies types, SSR, runtime hooks, counter updates, SPA navigation and reload in development and production preview. The prepared workflow in `.github/workflow-templates/package.yml` runs the same check on Node 24.21.0 after it is moved into `.github/workflows/`. Activation currently requires adding the `workflow` scope to the repository GitHub authentication. See [package documentation](packages/hono-pages/README.md) for configuration and public exports.

The plugin resolves server and DOM runtime entries using Vite's consumer environment. Compiled runtime entries share the public Pages import, and Hono stays outside dependency prebundling to preserve one context and hook implementation per environment. The package remains private and unpublished while the release and license decisions in Issue #12 are pending.

### Load-policy Hono islands

Issue #8 adds `.island.tsx` pages with Void's `with { island: 'load' }` imports. The adapter server-renders static page content and the initial interactive component, safely embeds props in Void's island markers, and mounts only interactive components using `initIslands`. Regular Pages navigation uses a document request for island routes.

The packed consumer at `fixtures/consumer` contains `/islands`, a loader-backed counter, and `/static`, a page with no interactive imports. `npm run check:consumer` verifies initial HTML, escaped props, counter updates and reload in development and preview. It also checks that static page sentinels never appear in client assets, then builds a project containing only static island pages and verifies empty executable client modules and zero script requests.

See the [package island documentation](packages/hono-pages/README.md#load-policy-islands) for syntax, supported policy and diagnostics. Island layouts, nested attributed imports and island form helpers remain unsupported.

### Deferred loader props

Issue #9 connects Void's deferred registry to Hono page state. Immediate props and loading UI render before the resolver completes. Initial HTML streaming and SPA NDJSON use the existing Void protocol. Page and layout state survive deferred updates; completions from disposed navigation cannot update a new page. An initial component-import buffer uses Void's existing queue to retain early results.

The packed consumer uses controlled server gates to prove shell rendering before completion, success/error UI, retained page/layout state and stale-result rejection. It also delays the initial component module and verifies that a result arriving during that delay survives initialization. `scripts/check-deferred-consumer.mjs` runs these checks through `npm run check:consumer` in development and production preview.

The public `Deferred<T>` export uses Void's discriminated loading/value/error state. The verified contract covers single deferred props on GET document requests and SPA navigation. Grouping, deferred prefetch, mutation-driven deferred refresh and islands are excluded. Void 0.26.0 forwards deferred resolver messages in production; the Hono adapter exposes that message as an `Error`. See the [package deferred documentation](packages/hono-pages/README.md#deferred-loader-props).
