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

このプラグインが担うのは JSX 変換だけです。Void の Pages アダプター登録、ファイルベース Pages ルーティング、loaders / actions、layouts、islands、クライアントルーター、状態維持 HMR、SSR DOM の再利用保証は実装していません。Vite の更新時には再読み込みで状態が失われる可能性があります。

## Hydration と公式 API の確認

Hono 4.13.13 では `hono/jsx/dom` が `render` を公開しています。`hydrateRoot` は `hono/jsx/dom/client` にあり、実装に hydrate は render 相当と記載されています。この PoC は `render` を使い、SSR が作ったカウンター領域をブラウザーで描き直します。React のような既存 DOM 再利用型 hydration と同じ保証はしません。

Void の Custom SSR entry 名、`defineRender`、assetTags、`voidPlugin()` の戻り値は確認した資料と一致しました。Hono の公式 Void 統合ガイドは middleware / helper の使用を説明していますが、Hono JSX の Pages アダプターとしての対応を保証する記述は確認していません。独自 Pages アダプターの公開登録 API も確認できていません。

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
