# Void × Hono JSX 最小 PoC

Void の Custom SSR で `hono/jsx` の HTML を返し、ブラウザーでは `hono/jsx/dom` でカウンターを描画する検証用プロジェクトです。クラウドへのデプロイ・認証は不要です。

**現在は SSR とビルド成果物まで確認済みです。カウンターの実ブラウザー操作と本番プレビューは未検証です。** 別のローカルセッションで続きを検証するために保存しています。

## 使用版

2026-10-08 の npm registry 確認時点で最新の `void` と `hono` を使用しました。再現には `package-lock.json` を使ってください。

| 項目 | 使用版 |
| --- | --- |
| Node.js | 24.21.0 |
| npm | 10.8.1 |
| Void | 0.26.0 |
| Hono | 4.13.13 |
| Vite | 8.3.3 |
| TypeScript | 7.0.2 |

Void 0.26.0 の engines は Node.js `>=24.21.0`、peerDependencies は Vite `^8.0.0` です。元の環境の Node.js 22.0.0 では要件を満たさなかったため、そこでの検証時だけ `.runtime` に Node.js を用意しました。このディレクトリは Git に含めていません。

## 再現手順

Node.js 24.21.0 以上を用意し、プロジェクトのルートで実行します。

```sh
node --version
npm ci
npm run typecheck
```

macOS / Linux では、Wrangler のログ保存先をプロジェクト内に指定できます。標準のホームディレクトリへのログ保存が許可されない環境で使ってください。`VOID_INSPECTOR_PORT=false` は Void が対応するローカルデバッガーのポート無効化設定です。

```sh
mkdir -p .void/logs
export WRANGLER_LOG_PATH="$PWD/.void/logs"
export WRANGLER_SEND_METRICS=false
export VOID_INSPECTOR_PORT=false
npm run dev
```

開発ページ: http://127.0.0.1:5173/

別の端末で同じ環境変数を設定し、本番ビルドとローカルプレビューを実行します。

```sh
export WRANGLER_LOG_PATH="$PWD/.void/logs"
export WRANGLER_SEND_METRICS=false
export VOID_INSPECTOR_PORT=false
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

## 引き継ぎ時点の検証結果

| 確認 | 結果 |
| --- | --- |
| npm から依存を取得 | 成功。180 packages を取得し lockfile を生成 |
| `npm run typecheck` | 成功。Vite config の import に `.ts` を付け、`allowImportingTsExtensions` を追加した最終状態でも再実行し、終了コード 0 と診断なしを確認 |
| `npm run dev` | 初回は sandbox のポート待ち受けが EPERM。承認済みのローカル実行と上記環境変数で起動成功 |
| `curl http://127.0.0.1:5173/` | 成功。初期 HTML に SSR の文章、カウンター 0、クライアント起動前の表示、Vite client と client entry の script を確認 |
| 開発時の Counter JSX 変換 | 成功。`hono/jsx/dom/jsx-dev-runtime` への import を確認 |
| `npm run build` | `dist/ssr` と `dist/client` の生成を確認。ただし Wrangler がホーム配下へのログ保存で EPERM を出力。ログ保存先を指定した再ビルドは未実施 |
| Mac の実ブラウザー操作 | ブロック。Chrome 拡張接続がタイムアウト。ネイティブ Chrome 操作も応答せず、ツール kernel が終了 |
| 連続クリック・リセット・再読み込み | 未実施 |
| 本番プレビューの HTTP / ブラウザー確認 | 未実施 |
| DOM テスト | 未実施 |

元のマシンでは `evidence/` に install / typecheck / dev / build のログ、SSR HTML、レスポンスヘッダー、開発時変換コードを保存しています。マシン固有の絶対パスや runtime 情報を含むため、Git には含めていません。

次のローカルセッションでは、上記環境変数で型チェック・ビルドを再実行し、開発と本番プレビューそれぞれで次を確認してください。

1. HTTP 初期 HTML に SSR 文章と `output#count` の 0 が含まれること。
2. ブラウザーに「クライアント起動済み: hono/jsx/dom」と表示されること。
3. `+1` を連続で押すと 1、2、3 と増えること。
4. リセットで 0 に戻ること。再び増やし、再読み込みで 0 に戻ること。
5. ブラウザー console とサーバーログに実行エラーがないこと。

## 参考にした公式資料

- [Void Quickstart](https://void.cloud/guide/quickstart)
- [Void Plugin API](https://void.cloud/reference/api/plugin)
- [Void Custom SSR](https://void.cloud/guide/ssr)
- [Void Hono integration](https://void.cloud/integrations/hono)
- [Void Pages Routing](https://void.cloud/guide/pages-routing/overview)
- [Hono Client Components](https://hono.dev/docs/guides/jsx-dom)
- [Vite Plugin API](https://vite.dev/guide/api-plugin)
