# npm 初回登録の検証記録

確認日: 2026-10-12 JST。npm の実アカウントは `ts-76`、2FA は `auth-and-writes` と確認しました。通常の npm 設定を変更せず、専用のログイン設定で初回登録を行いました。

## 登録結果

| 項目 | 実測した値 |
| --- | --- |
| Package | `void-plugin-hono-jsx` |
| 公開された npm 生成 placeholder | `0.0.0-stage`、`latest` tag、maintainer `ts-76` |
| 公開済みの登録専用 bootstrap | `0.0.0-bootstrap.0` / `bootstrap` |
| stage ID | `f4d6bcd7-16c8-45b9-b65f-76f23c84b6fd` |
| Registry status | owner が npm サイトで approve、公開 version が存在 |
| 候補の SHA256 | `19d01c767d8626de49ec3294684c2305c9202b2881a8e22d8ade9eb11b9be27e` |
| 候補の integrity | `sha512-PS3/lLzqlZu9JIe2yaPxz9TzPn8pHfb2zzXGQ/yGMWmvDbyCyjyucEQcELColWr2dXB+TgsM9XEWvqGpifPesA==` |
| 候補の内容 | package.json、README.md、MIT LICENSE の3ファイル、1170 bytes。アダプターコード・依存・scripts なし |
| CLI / runtime | npm 12.2.0 / Node 24.18.0。初回 owner 操作のみ |
| 実送信 | 固定 tgz、ignore-scripts、access public、tag bootstrap、provenance false |
| 再取得 | owner の stage download で同じ SHA256 と integrity を確認 |

bootstrap は登録専用です。maintainer が npm サイトで bootstrap と alpha を approve したと確認しました。公開 bootstrap の再取得でも同じ digest を確認しています。bootstrap はアダプター実装を含まず、利用対象は `void-plugin-hono-jsx@next` です。alpha は GitHub Actions の pnpm 12.11.2 / Node 24.21.0 / OIDC / provenance 経路で別途 stage し、公開後の署名検証にも成功しました。bootstrap の成功をその経路の証拠に置き換えません。

新規 stage は公開 placeholder を作りますが、候補の内容は承認まで非公開です。[npm staged publishing](https://docs.npmjs.com/staged-publishing/)

## 初回 owner 操作に限定した CLI 評価

npm 12.2.0 の再監査は High 3 / Moderate 2 の5 leaf package、独立した12 advisoryでした。[以前の npm CLI 評価](publisher-security.md)と同じ指摘で、修正・audit 0 とは扱いません。pnpm の Rust 4指摘の受入を npm に広げた結果でもありません。

登録専用の固定 tgz について、npm の実 command / pack / registry client を使用し、HTTP応答だけを fixture に置き換えたオフライン観測を追加しました。正常系と stage POST 500 の両方で送信試行は1回、ライフサイクル・子プロセス・外部通信は0回でした。brace expansion、selector parser、Address4/6 の呼出しは0回で、小さい正常入力で各計測器の positive control を確認しました。npm 同梱 undici は未ロード、Sigstore attestation は0回です。実通信の DNS/TLS と全エラー経路の非到達性は証明していません。

http-cache-semantics は constructor / storable を各2回使用しました。未使用とは扱わず、新規の専用 cache、専用 user/global config、proxy や既存設定を渡さない環境、固定した registry を条件として限定評価しました。owner 認証はこの操作の専用設定だけに保持し、CI secret・成果物・Git には含めません。

Trusted Publisher の保存は別の2FAを必要とします。指定は `ts-76/void-plugin-hono-jsx`、workflow `npm-stage.yml`、environment `npm-stage`、permission `createStagedPackage` のみです。直接 publish 権限を追加しません。追加2FA後、npm の保存応答で trust ID `f0e05f69-46bb-411c-b1b8-b79f7991af6e` と上記の全項目・stage 専用 permission を確認しました。実 OIDC stage の成功は別途確認済みです。owner 専用 credential は logout で失効させ、専用 config を削除しました。

## alpha の検証結果

設定保存後、source `1805f4f` / tag `v0.1.0-alpha.0` の実 stage が成功しました。npm サイトでの owner 承認後、公開 tarball、next tag、独立した provenance / registry signature 検証、registry からのインストールを確認しています。[実検証結果](stage-validation-result.md)で bootstrap と alpha、公開前と公開後の証拠を区別しています。
