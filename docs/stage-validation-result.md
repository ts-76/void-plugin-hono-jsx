# 実 OIDC / provenance stage の検証結果

確認日: 2026-10-12 JST。`void-plugin-hono-jsx@0.1.0-alpha.0 / next` の実 stage は成功し、候補は npm の承認待ち `staged` になりました。最終 approve / reject は実行していません。**署名 bundle を取得できていないため、独立した暗号検証は未完了です。**

## 実行と成果物の照合

| 対象 | 確認した値 |
| --- | --- |
| Source commit | `1805f4f88b74962d821039f20ca881fed639de85` |
| Tag | `v0.1.0-alpha.0`、上記 commit を指す |
| Main CI | [Package 38154501678](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/38154501678) / [Publisher 38154501644](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/38154501644)、両方成功 |
| 実 workflow | [38154744628 / attempt 1](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/38154744628)、config / prepare / stage 全て成功 |
| 受理した artifact | 同じ run / attempt の `accepted-node-24.21.0-1805f4f88b74962d821039f20ca881fed639de85-attempt-1` |
| Plan | `ready`、blockers なし |
| Environment | `npm-stage`、指定の ts-76 単独承認。管理者 bypass なし、v* tag のみ |
| 実 stage ID | `f0c9d1fb-0777-4bf6-bc2d-27f0c2b12d48` |
| npm の actor / actorType | `GitHub Actions` / `trusted automation` |
| Candidate | `0.1.0-alpha.0`、tag next、access public、status staged |
| Publisher | 固定 Linux x64 pnpm 12.11.2 / Node 24.21.0、ignore-scripts、provenance true |
| SHA256 | `28911094902d08b5395600325b18eb7987591a63c839e2fb102be7bc4ede8112` |
| SHA512 integrity | `sha512-YxPH4BSrixW4Mx+27yGqEyzssVZDO2QvHTqtTE4a4O9HqWqTei0Kt0DLqnrqH1NkrqEgm/6BLZ4JupIxYk2ntg==` |
| npm stage download | 29 regular files、17622 bytes、上記 SHA256 と integrity が一致 |

stage job は実 OIDC exchange を必須として通過し、専用の短期 credential と固定 tgz で送信しました。pnpm の固定ソースでは provenance true の送信前に Fulcio / Rekor による署名 bundle を生成し、添付に含めます。workflow の成功と registry の trusted automation 受理を確認しましたが、bundle 本体の取得・独立検証を代替する結果ではありません。

Publisher の517 crateを実stage直前に再監査し、受け入れ済みの4指摘だけでした。root / packed consumer の依存監査も既知の esbuild advisory のみで plan が ready になりました。全49 commitの履歴監査は findings 0、過去の検証成果物15パスは履歴に残ります。これらは audit 0 や全経路の安全性認証を意味しません。

## 残る署名検証

今回の owner 認証による `npm stage view <id> --json` 応答には、署名 bundle・attestation URL・署名情報が含まれませんでした。`stage download` は tgz だけを返します。npm の公開用 `/-/npm/v1/attestations/void-plugin-hono-jsx@0.1.0-alpha.0` は owner 認証でも404でした。これは今回確認した応答であり、署名が存在しないことや、あらゆる取得方法が不可能であることの証明ではありません。

最終承認前の独立検証には、送信した bundle 自体を保持する経路、または registry から同じ bundle を取得する経路が必要です。取得後に署名、Fulcio issuer / workflow identity、source commit / run / tag、SHA512 subject、transparency inclusion を検証します。別途署名した bundle を今回送信した bundle の代わりにしてはいけません。現在の receipt は source / run / digest / stageId を保存しますが、bundle 本体を保存しません。

最終 approve を使って公開用 endpoint を確認することは、この検証の代わりに無断で実行しません。bundle 保持方法を追加して別候補を stage するか、公開後に独立検証する制約を受け入れるかは、実装・候補を具体化して maintainer が判断します。現候補はその判断まで pending のまま保ちます。[npm staged publishing](https://docs.npmjs.com/staged-publishing/)、[npm provenance](https://docs.npmjs.com/generating-provenance-statements/)

## 検証後の状態

再送防止のため repository variable `NPM_STAGING_ENABLED` は false に戻しました。policy の stageEnabled / publicPackageEnabled は true、Trusted Publisher は stage 専用のままです。手動 workflow は repository gate を満たさないと送信しません。再実行前に pending state と候補・署名取得手順を確認します。

登録専用 [bootstrap](bootstrap-registration.md) と alpha の両候補が pending です。bootstrap は approve してはいけません。npm で公開されているのは `0.0.0-stage` placeholder で、alpha の公開 version はまだ存在しません。alpha 最終承認時には個人2FA、公開 metadata / next tag / provenance、fresh consumer を別途確認します。

受理した prepare artifact、stage-receipt.json、再取得 tgz と verification.json は、この作業の `/private/tmp/void-plugin-hono-jsx-stage-38154744628-20261012/` に保存しました。GitHub artifact は7日 retentionです。owner session credential は成果物とGitに含めていません。
