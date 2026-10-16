# 実 OIDC / provenance stage と alpha 公開の検証結果

この文書は alpha.0 の履歴証拠です。下記の version・dist-tag・publisher・source は検証時点の値であり、現行状態や次候補の検証結果ではありません。現行案内は [公開手順](releasing.md) と [リリースチェックリスト](release-checklist.md) を参照してください。

確認日: 2026-10-12 JST。`void-plugin-hono-jsx@0.1.0-alpha.0 / next` の実 stage は成功し、maintainer `ts-76` が npm サイトで approve したと確認しました。公開 registry の metadata・tarball・署名 bundle を取得し、**独立した暗号検証も完了しました。** 自動化と今回の CLI 操作は最終 npm approve を実行していません。

## 実行と成果物の照合

| 対象 | 確認した値 |
| --- | --- |
| Source commit | `1805f4f88b74962d821039f20ca881fed639de85` |
| Tag | `v0.1.0-alpha.0`、上記 commit を指す。公開後の文書更新では動かさない |
| Source main CI | [Package 38154501678](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/38154501678) / [Publisher 38154501644](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/38154501644)、両方成功 |
| 実 workflow | [38154744628 / attempt 1](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/38154744628)、config / prepare / stage 全て成功 |
| 受理した artifact | 同じ run / attempt の `accepted-node-24.21.0-1805f4f88b74962d821039f20ca881fed639de85-attempt-1` |
| Plan | `ready`、blockers なし |
| Environment | `npm-stage`、ts-76 単独承認、管理者 bypass なし、v* tag のみ |
| 実 stage ID | `f0c9d1fb-0777-4bf6-bc2d-27f0c2b12d48` |
| npm publisher / approver | `GitHub Actions`（trusted automation） / `ts-76` |
| 公開 version / tag | `0.1.0-alpha.0` / `next`、access public |
| 公開時刻（registry） | `2026-10-11T16:24:11.334Z` |
| Publisher | 固定 Linux x64 pnpm 12.11.2 / Node 24.21.0、ignore-scripts、provenance true |
| SHA256 | `28911094902d08b5395600325b18eb7987591a63c839e2fb102be7bc4ede8112` |
| SHA512 integrity | `sha512-YxPH4BSrixW4Mx+27yGqEyzssVZDO2QvHTqtTE4a4O9HqWqTei0Kt0DLqnrqH1NkrqEgm/6BLZ4JupIxYk2ntg==` |
| 内容 | 29 regular files、17622 bytes。受理した artifact、owner stage download、公開 tarball が同一 digest |

stage job は実 OIDC exchange を必須として通過し、専用の短期 credential と固定 tgz で送信しました。Publisher の517 crateを実stage直前に再監査し、受け入れ済みの4指摘だけでした。root / packed consumer の監査は各 Moderate 5 package entries、既知の GHSA-67mh-4wv8-2f99 のみです。全49 commitの履歴監査は findings 0、過去の検証成果物15パスは履歴に残ります。これらは audit 0 や全経路の安全性認証を意味しません。

## 公開 provenance と registry 署名

公開後、[npm attestation endpoint](https://registry.npmjs.org/-/npm/v1/attestations/void-plugin-hono-jsx@0.1.0-alpha.0) が200を返し、実際の公開 bundle を取得できました。専用 TUF cache と npm 12.2.0 同梱 Sigstore verifier を使用し、owner credential を渡さずに独立検証しました。

- Sigstore bundle の署名検証成功。Fulcio certificate issuer は `https://token.actions.githubusercontent.com`。
- certificate identity は `https://github.com/ts-76/void-plugin-hono-jsx/.github/workflows/npm-stage.yml@refs/tags/v0.1.0-alpha.0` と完全一致。
- CT log / transparency log の検証 threshold は各1。署名 bundle の verifier が成功。
- SLSA v1 subject は `pkg:npm/void-plugin-hono-jsx@0.1.0-alpha.0`、SHA512 は公開 tarball と一致。
- workflow path / repository / tag、resolved source commit `1805f4f88b74962d821039f20ca881fed639de85`、invocation の run `38154744628 / attempts/1` が一致。
- npm 公開 key による registry ECDSA signature の検証成功。対象は version と integrity を含む公開 package metadata。

bundle の正規化 JSON（JSON.stringify）の SHA256 は `be205a059ffb1abbc9fd6dc4a988e3304b15dff8441f9133b6d2fcdfa55fa136`。receipt だけや別途署名した bundle を検証根拠にしていません。[npm provenance](https://docs.npmjs.com/generating-provenance-statements/)

承認前の owner `stage view` は bundle を含まず、`stage download` は tgz のみ、公開 attestation endpoint は404でした。したがって、今回の独立暗号検証は**公開後**に実施したものです。承認前に同じ検証が必要な将来の release では、送信した bundle を保持・取得する経路が引き続き必要です。

## Registry からのインストール

公式配布から SHA256 を照合した Node 24.21.0 を使用し、空の project、新規 npm config / cache、owner credential なしで `void-plugin-hono-jsx@next` を registry からインストールしました。lockfile の resolved URL と integrity が公開 metadata に一致し、全29ファイルが公開 tarball と byte単位で一致しました。全 export と declaration の target file が存在します。

この公開後チェックは `--legacy-peer-deps --ignore-scripts` で peer の再インストールを省略した内容検証です。Void/Vite と browser の統合チェックを公開後に再実行した結果ではありません。型・dev・build・preview・browser・islands・deferred・static・ISR の full consumer は、同じ SHA256 の受理 artifact に対して stage の prepare CI で成功しています。ローカルの容量不足を受け、この二つの検証範囲を区別しています。

```sh
npm install void-plugin-hono-jsx@next hono@4.13.13
npm install --save-dev void@0.26.1 vite@8.3.3 typescript@7.0.2
```

## 検証後の状態

repository variable `NPM_STAGING_ENABLED` は false、policy の stageEnabled / publicPackageEnabled は true、Trusted Publisher は stage 専用です。再送防止の gate を維持し、今後は新しい version と source/tag を検証します。

maintainer は登録専用 [bootstrap](bootstrap-registration.md) も npm サイトで approve しました。公開 tag は `latest: 0.0.0-stage`、`bootstrap: 0.0.0-bootstrap.0`、`next: 0.1.0-alpha.0` です。placeholder と bootstrap にはアダプター実装がないため、利用対象は `@next` です。公開済み version を上書きせず、文書の更新は新しい commit に記録します。alpha の packed README は公開前の説明を含みますが、公開 bytes と provenance の対応は維持します。

成果物と検証結果は `/private/tmp/void-plugin-hono-jsx-stage-38154744628-20261012/` に保存しました。`published-signature-verification.json`、`published-consumer-verification.json` と公開 bundle / tarball を含みます。GitHub artifact は7日 retentionです。専用 owner credential は logout で失効させ、専用 npm config を削除しました。通常の npm 設定と CI secret は変更していません。既知の macOS 開発 transport 制約と managed deployment 未検証は継続します。
