# npm 初回登録の検証記録

確認日: 2026-10-12 JST。npm の実アカウントは `ts-76`、2FA は `auth-and-writes` と確認しました。通常の npm 設定を変更せず、専用のログイン設定で初回登録を行いました。

## 登録結果

| 項目 | 実測した値 |
| --- | --- |
| Package | `void-plugin-hono-jsx` |
| 公開された npm 生成 placeholder | `0.0.0-stage`、`latest` tag、maintainer `ts-76` |
| 非公開の bootstrap 候補 | `0.0.0-bootstrap.0` / `bootstrap` |
| stage ID | `f4d6bcd7-16c8-45b9-b65f-76f23c84b6fd` |
| Registry stage status | `staged` |
| 候補の SHA256 | `19d01c767d8626de49ec3294684c2305c9202b2881a8e22d8ade9eb11b9be27e` |
| 候補の integrity | `sha512-PS3/lLzqlZu9JIe2yaPxz9TzPn8pHfb2zzXGQ/yGMWmvDbyCyjyucEQcELColWr2dXB+TgsM9XEWvqGpifPesA==` |
| 候補の内容 | package.json、README.md、MIT LICENSE の3ファイル、1170 bytes。アダプターコード・依存・scripts なし |
| CLI / runtime | npm 12.2.0 / Node 24.18.0。初回 owner 操作のみ |
| 実送信 | 固定 tgz、ignore-scripts、access public、tag bootstrap、provenance false |
| 再取得 | owner の stage download で同じ SHA256 と integrity を確認 |

bootstrap は登録専用の候補です。**approve してはいけません。** alpha の `0.1.0-alpha.0 / next` は別の候補として GitHub Actions の pnpm 12.11.2 / Node 24.21.0 / OIDC / provenance 経路で検証します。bootstrap の成功はその経路の成功を証明しません。

新規 stage は公開 placeholder を作りますが、候補の内容は承認まで非公開です。[npm staged publishing](https://docs.npmjs.com/staged-publishing/)

## 初回 owner 操作に限定した CLI 評価

npm 12.2.0 の再監査は High 3 / Moderate 2 の5 leaf package、独立した12 advisoryでした。[以前の npm CLI 評価](publisher-security.md)と同じ指摘で、修正・audit 0 とは扱いません。pnpm の Rust 4指摘の受入を npm に広げた結果でもありません。

登録専用の固定 tgz について、npm の実 command / pack / registry client を使用し、HTTP応答だけを fixture に置き換えたオフライン観測を追加しました。正常系と stage POST 500 の両方で送信試行は1回、ライフサイクル・子プロセス・外部通信は0回でした。brace expansion、selector parser、Address4/6 の呼出しは0回で、小さい正常入力で各計測器の positive control を確認しました。npm 同梱 undici は未ロード、Sigstore attestation は0回です。実通信の DNS/TLS と全エラー経路の非到達性は証明していません。

http-cache-semantics は constructor / storable を各2回使用しました。未使用とは扱わず、新規の専用 cache、専用 user/global config、proxy や既存設定を渡さない環境、固定した registry を条件として限定評価しました。owner 認証はこの操作の専用設定だけに保持し、CI secret・成果物・Git には含めません。

Trusted Publisher の保存は別の2FAを必要とします。指定は `ts-76/void-plugin-hono-jsx`、workflow `npm-stage.yml`、environment `npm-stage`、permission `createStagedPackage` のみです。直接 publish 権限を追加しません。認証・設定保存と、実 OIDC stage の成功はそれぞれ確認します。

## 残る検証

main `3ecda4d542bc37418e47799456f43c35e4891fcd` の Package CI と Publisher CI は成功しました。[Package CI](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/38153662943)、[Publisher CI](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/38153662942)。有効化後の commit と tag は別途 CI / 同一 run の prepare artifact を必要とします。

Trusted Publisher の実設定、stage フラグと repository variable、release tag、GitHub environment 承認、実 OIDC / Fulcio / Rekor / registry stage の照合が残ります。署名 bundle 自体と検証結果がなければ、receipt だけで暗号検証完了とはしません。alpha の最終 npm approve はこの stage 検証に含めません。
