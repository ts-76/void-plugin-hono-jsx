# 以前の npm 公開ツールの比較評価

現在の公開 job は pnpm 11.28.6のJavaScript配布物に切り替えています。[pnpm の到達経路評価と採用条件](pnpm-publisher-assessment.md)を参照してください。以下は切替前の npm CLI の限定評価を保存した記録であり、現行 job の構成を示すものではありません。

確認日: 2026-10-11。評価対象は source commit `d1d7e05af9fe70485c7dc063743af67db4e18b5e` の stage 公開手順、npm CLI 11.21.0、Node 24.21.0、固定した `void-plugin-hono-jsx@0.1.0-alpha.0` の tarball です。

**現行 npm は、公開プロセスの設定・キャッシュを隔離し、対象を限定した監査例外を設ける条件で、今回の alpha の公開ツールとして受け入れ可能と評価します。これは受け入れの提案であり、承認・脆弱性の修正・公開完了ではありません。** npm の置換を必須とする根拠は見つかっていません。一方、pnpm 11 以降には独自の公開実装があり、独自 publisher の開発より先に比較する候補です。

## 監査対象と配布対象

隔離した設定と新しい監査キャッシュで npm 11.21.0 の依存関係を再監査しました。High 3 / Moderate 2 の計 5 パッケージ、独立した advisory は 12 件、Critical は 0 件です。npm 12.2.0 への更新、非公開 fixture の override、audit fix でも、この 5 ライブラリの同梱版と指摘は変わりませんでした。

これらは公開ツールに同梱された依存関係で、アダプターの tarball に含まれません。[Void 経由の esbuild の既知制約](dependency-security.md)の受け入れとは別の判断です。指摘の非到達性を限定的に確認しても audit は 0 件になりません。

## 固定 tarball の stage 公開で通る経路

```text
stage.mjs: commit / artifact / environment / registry の事前照合
  → npm stage publish <固定 tgz> --ignore-scripts --json
      --registry https://registry.npmjs.org/ --access public
      --tag next --provenance=true
  → pacote の FileFetcher: ローカル tgz の読取り・manifest の抽出
  → GitHub OIDC の取得（audience npm:registry.npmjs.org）
  → npm の package 固有 token exchange（POST）
  → registry metadata の GET（preferOnline: true）
  → provenance statement の生成と Sigstore attestation
      → GitHub OIDC（audience sigstore）/ Fulcio / Rekor
  → stage endpoint の POST
  → stageId / integrity の照合、owner の最終 2FA 承認待ち
```

`libnpmpack` はこの経路で既存 tgz の bytes を読みます。directory の pack/publish と異なり、ライフサイクルスクリプトと node-gyp を実行する経路ではありません。npm の OIDC は token を request options とメモリー上の CLI config に設定し、設定ファイルへ保存しません。ただし失敗時には既存の認証情報へフォールバックできる設計なので、長期 token・既存ログインのない設定を使うことが条件です。

npm の registry/OIDC と Sigstore の HTTP client は `make-fetch-happen → minipass-fetch → @npmcli/agent` を使います。npm に同梱された undici を registry HTTP client と同一視していません。`stage.mjs` 自体の事前照合に使う Node の `fetch` は別実装で、実測した Node 24.21.0 の内蔵 undici は 7.29.1 です。これは今回の undici 3 advisory の修正版に該当します。[Node 24.21.0 release](https://github.com/nodejs/node/releases/tag/v24.21.0)

## 各指摘の発動条件との照合

| ライブラリ・同梱版 | 指摘の条件 | 観測した経路と判断 |
| --- | --- | --- |
| brace-expansion 5.0.9 / 3 advisory | 悪意ある brace/glob pattern による計算量・再帰の DoS | minimatch が import するが、固定 tgz の stage fixture では expand 呼出し 0。外部入力を pattern として渡す経路は今回の source inspection では確認されず。今回のコマンドに限定して受け入れ可能 |
| postcss-selector-parser 7.1.4 / 1 advisory | 多数の class/id を含む平坦な selector の解析による CPU 消費 | @npmcli/query が import するが、stage fixture では parser 呼出し 0。依存関係の query を実行しない。今回のコマンドに限定して受け入れ可能 |
| ip-address 10.5.0 / 4 advisory | link-local/NAT64 の分類・異なるアドレスファミリーの範囲判定の誤り、巨大な IPv6 入力の解析 | socks が import するが、proxy のない fixture では Address4/6 の構築 0。外部からの分類・範囲判定をアクセス許可判断に使う caller は今回の同梱コード検索では確認されず。proxy・設定の隔離を条件に受け入れ可能 |
| undici 6.28.0 / 3 advisory | WebSocket handshake/decompression の DoS 2 件、retry interceptor と downstream response forwarding の組合せ 1 件 | 同梱物での import は node-gyp の download に確認。stage fixture と独立した Sigstore HTTP client fixture では未ロード。公開手順は WebSocket や downstream HTTP server を使用しない。今回のコマンドに限定して受け入れ可能 |
| http-cache-semantics 4.2.0 / 1 advisory | shared-cache と max-stale による他ユーザーの応答再利用 | 公開経路で constructor/storable を実際に使用。未使用とは判断しない。専用 cache と config の隔離・既存 cache を復元しない運用を条件に受け入れ可能 |

brace-expansion: [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr)、[GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7)、[GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p)。selector parser: [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)。

ip-address: [GHSA-rpw4-54j3-4h4q](https://github.com/advisories/GHSA-rpw4-54j3-4h4q)、[GHSA-2vr4-cq9g-pvrc](https://github.com/advisories/GHSA-2vr4-cq9g-pvrc)、[GHSA-j6r3-76f7-8jcv](https://github.com/advisories/GHSA-j6r3-76f7-8jcv)、[GHSA-h3mg-xc3c-68pw](https://github.com/advisories/GHSA-h3mg-xc3c-68pw)。

undici: [GHSA-3wwx-pv8p-q78v](https://github.com/advisories/GHSA-3wwx-pv8p-q78v)、[GHSA-rfgv-xxqx-mfg5](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5)、[GHSA-r53p-7pc4-xj5r](https://github.com/advisories/GHSA-r53p-7pc4-xj5r)。cache: [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)。

## キャッシュの留保と確認結果

make-fetch-happen は `shared: false` を指定し、GET/HEAD のみをキャッシュします。GitHub OIDC の取得と Sigstore の各 HTTP client は、この呼出しでは cachePath を設定しません。npm の token exchange と stage upload は POST でキャッシュ再利用の対象ではありません。metadata の GET は `preferOnline: true → cache: no-cache` で必ず再検証する経路です。

ただし **shared: false だけで異なる認証情報の混在を防げるわけではありません。** 実際の make-fetch-happen のディスクキャッシュを使い、HTTP transport のみを fixture に置き換えた確認では、同じ URL・同じ cachePath で認証情報 A → B と変更すると、fresh な応答と max-stale を指定した stale な応答の両方で A の fixture 応答を再利用しました。no-cache による再検証、または別 cachePath では B の応答を取得しました。これは人工的な応答・認証の条件での再利用であり、npm registry での実際の session 漏えいを実証したものではありません。

上流では報告内容が争われていますが、この評価では false positive として除外していません。4.3.0 は advisory の範囲外でも、挙動の修正は確認できていません。[上流 Issue](https://github.com/kornelski/http-cache-semantics/issues/56)、[advisory database の見直し Issue](https://github.com/github/advisory-database/issues/10139)

## オフライン検証と限界

npm CLI の実際の Npm class・stage command・pacote・libnpmpack・npm-registry-fetch・cache・agent construction を動かしました。ネイティブ HTTP/HTTPS/socket/TLS/DNS/global fetch と子プロセスは拒否し、minipass-fetch の応答 transport と sigstore.attest の署名境界を fixture に置き換えています。実際の CLI entrypoint を別プロセスから無変更で実行した検証ではありません。

以下 7 ケースの assertion が通過しました。意図した失敗ケースも、npm の処理が失敗したことを確認した probe の成功として数えています。

1. 正常系: package/version、next/public、固定 tgz bytes、SHA512 subject、source commit/workflow を確認し、mock stage POST は 1 回。
2. OIDC exchange の token 欠落: ENEEDAUTH、署名・stage POST は 0 回。
3. 署名境界の失敗: stage POST は 0 回。
4. stage POST の 500 応答: E500、POST は 1 回。make-fetch-happen は POST を再試行しない。
5. metadata GET の 503 → 200: GET を再試行して正常に進む。undici はロードしない。
6. Sigstore の独立した CI identity / Fulcio / Rekor HTTP client: fixture 応答で経路を確認。無効な fixture certificate を使い、暗号署名・証明書検証は行わない。
7. cache 条件: 異なる認証情報での応答再利用、no-cache 再検証、別 cachePath、POST の非再利用を確認。

ライフサイクル・子プロセス・ネイティブ通信の呼出しは観測されず。brace/selector/IP の計測器は、小さい正常入力を別途与えると計数が増える positive control を確認しました。実送信と署名は mock なので、本物の stageId・OIDC authority・registry authorization・certificate issuance・transparency inclusion・owner approval/2FA は **未検証** です。DNS/TLS/socket、すべての redirect/retry/cache/エラー応答、bootstrap install、他の npm コマンドや将来の入力を網羅した結果でもありません。

証跡は ignored な `artifacts/publisher-security-investigation/reachability-results.json`、同じフォルダの `reachability-audit.json`、`reachability-probe.cjs`、`reachability-runner.py` に保存しています。JSON は実装ソースの SHA256 と該当行、全 advisory、ケース別の呼出し記録、計測器の positive control を含みます。固定 tgz の SHA256 は `9e4ad569c3909be35cecffd844d03659f9f75509965a70e76d5023d7b689bbb5` で変更していません。

## 受け入れる場合の実装条件

評価時の workflow は job-local npm の pin、ignore-scripts、cache restore の無効化、artifact/protection の照合を備えています。ただし stage の子プロセス専用 cache、空の user/global config、proxy と既存 credential の排除はまだ明示的に保証していません。この条件を実装し確認してから、限定した例外を有効にします。

- 公開プロセスに新規の専用 cachePath を与え、bootstrap installer の cache や他ユーザー・別認証の cache を共有・復元しない。cache/config を artifact として保存しない。
- 別々の空の user/global config を指定し、project config と環境変数も含めて既存 npm credential・proxy・preferOffline/force-cache 等の設定が混入しないことを検証する。GitHub の OIDC に必要な変数は保持する。
- 今回の npm/Node 版、package/version/tag、固定 tgz、registry と stage command に対象を限定し、directory publish・install/rebuild/query 等へ適用しない。override で同梱物を改変しない。
- 監査は継続し、承認する advisory URL・対象 leaf の版・公開用 npm の版を明記する。新しい advisory、対象・版・公開経路の変更、隔離条件の不一致は upload 前に停止する。全面的な audit 無効化にはしない。
- protected environment、tarball/evidence 照合、OIDC/provenance と owner の最終 2FA 承認を維持する。公式修正版が出た場合は再監査・再評価する。

npm CLI のこの比較調査自体では、release-policy、公開フラグ、認証、repository visibility を変更しませんでした。後続の pnpm 採用では、公開フラグを維持して publisher と専用監査ゲートを切り替えています。

## Bun / pnpm による公開との比較

npm registry への公開に npm CLI 自体が必須というわけではありません。

| 候補 | 通常の npm 公開 | 今回の stage / OIDC / provenance | 評価 |
| --- | --- | --- | --- |
| npm 11.21.0 | 対応 | 対応。上記経路を検証 | 隔離・限定した監査例外を条件に継続可能 |
| pnpm 11 以降 | npm CLI に委譲しない独自実装 | stage は 11.3.0 以降。trusted publishing と provenance を公式 docs に記載 | 12.11.2 の stage/OIDC fixture を検証。12.11.2 の Linux Rust inventory と発動条件を後続評価し、4 件を限定受入して採用。署名付きの実 stage は未検証 |
| Bun | 対応。既存 tgz を渡して公開可能 | OIDC と provenance の対応要求は確認時点で open。stage を含めて今回の条件を満たす構成は未確認 | 通常公開の候補だが、現在の公開手順への置換を承認した結果ではない |

[pnpm publish](https://pnpm.io/cli/publish)、[pnpm stage](https://pnpm.io/cli/stage)、[Bun publish](https://bun.com/docs/pm/cli/publish)、[Bun OIDC 対応 Issue](https://github.com/oven-sh/bun/issues/22423)、[Bun provenance 対応 Issue](https://github.com/oven-sh/bun/issues/15601)。pnpm の公開 registry で確認した latest は 12.11.2 です。最新 docs の記載だけでその版の全挙動や安全性を確認したとは扱いません。

後続の [pnpm 検証](pnpm-publisher-assessment.md)で、12.11.2 の実 CLI、Cargo で解決した 517 crate、残る 4 指摘の発動条件、隔離・OIDC 事前 gate を評価し、公開 job のみに採用しました。11.28.5 の bundle の High を承認したものではありません。mock 検証と実 registry での署名付き stage 成功は区別します。
