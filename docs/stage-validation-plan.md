# 実 OIDC / provenance 付き stage の準備

確認日: 2026-10-12 JST。maintainer が repository を `void-plugin-hono-jsx` に改名・公開しました。元の開発・マージ履歴を復元し、2026-10-09 の別アカウントの作者・コミッター情報だけを現在のアカウントへ修正済みです。改名と公開準備の変更を含む main `f8ba812` の CI は通過しました。npm owner は `ts-76`、GitHub は単独承認として maintainer が指定しました。初回の owner bootstrap stage は実施済みで、npm 生成 placeholder が公開されています。alpha の OIDC stage・最終承認は未実施です。

## 現状と必要な判断

| 対象 | 確認した状態 | 次に必要なこと |
| --- | --- | --- |
| GitHub repository | `ts-76/void-plugin-hono-jsx` として public | repository metadata / policy を改名に揃えた。Trusted Publisher は新しい名前で設定 |
| Git 履歴 | 元の 46 commit とマージ構造を維持し、Oct 9 の 17 commit の別アカウント情報だけを修正 | 最終 commit で全履歴を再監査。過去の成果物 15 パスが履歴に残る。親 SHA の変更と無効な署名の除去が必要。旧 PR refs・cached commit・外部 clone は別に残り得る |
| npm package | 実ログイン owner は `ts-76`、2FA は auth-and-writes。package の公開 placeholder は `0.0.0-stage`、maintainer は ts-76 | alpha.0 の存在と pending state を実 stage 直前に再確認 |
| 初回登録 | `0.0.0-bootstrap.0 / bootstrap` を owner が stage、status staged、download digest 一致 | [登録記録](bootstrap-registration.md)。bootstrap は approve しない。alpha は別の候補 |
| GitHub environment | `npm-stage` 作成済み。required reviewer は `ts-76`、admin bypass は false、tag `v*` のみ許可。API 状態を stage gate で照合済み | 実際の workflow の承認待ちと手動承認は stage 実行時に確認 |
| 承認者 | 単独承認を指定済み。policy の reviewers は User `ts-76`、preventSelfReview は false。environment と一致 | policy 変更を commit / main に反映し、最終 commit の CI を確認。npm の最終 approve は別の個人 2FA 操作 |
| Trusted Publisher | 指定値で CLI dry-run 済み。保存は追加2FAの完了待ち | 下記の正確な値で stage のみに許可。実設定の保存と照合が必要 |
| 有効化 | stageEnabled / publicPackageEnabled は false、historyDisclosureApproved は true。repository variables は未設定、tag はなし | 残る判断後に policy と GitHub 設定を一致させ、`NPM_STAGING_ENABLED=true`、承認済み commit の release tag を設定 |

公開 provenance は public source repository が必要です。Sigstore の透明性ログに署名情報が記録されることも公開判断に含めます。[npm provenance](https://docs.npmjs.com/generating-provenance-statements/)

## 初回登録と alpha stage の分離

現在の `stage.mjs` は既存 package の metadata が 200 で、maintainers に `npmOwner` が含まれることを要求します。未登録 package の初回 OIDC bootstrap は実装していません。

推奨は、owner が手動 bootstrap stage で package を初期登録し、その後 Trusted Publisher を設定して alpha の OIDC stage を検証する順序です。最初の手動 stage を即座に approve する必要はありません。新規 stage による公開 placeholder と、候補の contents が承認まで非公開である点を区別します。[npm staged publishing](https://docs.npmjs.com/staged-publishing/)

bootstrap の CLI・認証方法・対象 version は事前に決めます。別の bootstrap version を使えば alpha.0 の pending stage との衝突を避けられます。同じ alpha.0 を使う場合は、owner が pending stage を確認し、取り下げ・再登録の扱いと registry 状態を確認してから OIDC stage を行います。pnpm の限定受入は Linux x64 の固定 tgz 経路であり、未検証の bootstrap 操作へ自動的に広げません。

## Trusted Publisher の設定値

| npm 設定項目 | 値 |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `ts-76` |
| Repository | `void-plugin-hono-jsx` |
| Workflow filename | `npm-stage.yml`（フルパスではない） |
| Environment name | `npm-stage` |
| Allowed actions | stage のみ。直接 publish / dist-tag 管理を追加しない |

workflow の GitHub-hosted Ubuntu runner、id-token: write、明示的 provenance、OIDC 事前交換、隔離設定、監査ゲートは実装済みです。長期 npm token の CI secret は追加しません。npm に保存した設定の正しさは実際の stage 操作で確認します。`npm whoami` は Trusted Publisher の権限検証にはなりません。[npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/)

## 実行順序と合格条件

1. owner `ts-76` と単独承認の判断を policy に反映済み。残る bootstrap の対象 version と認証、公開 placeholder、透明性ログへの記録を判断する。
2. 公開・保護設定、owner の初回登録、stage-only Trusted Publisher を設定し、実際の API 状態と policy を照合する。
3. policy 変更を main に反映して最終 commit の CI を通す。候補 tgz、audit / history evidence と既知の開発 transport 制約を確認し、その commit の `v0.1.0-alpha.0` tag を承認する。別の候補 version を採用する場合は manifest / policy / tag を一緒に更新する。
4. tag に対して `npm-stage.yml` を手動 dispatch。同じ run / attempt の prepare artifact を stage が使用し、GitHub environment の承認後に送信する。過去の Package CI artifact は新 run の証跡を代替しない。
5. 実 OIDC exchange、Fulcio / Rekor 署名、registry stage 受理と実 stageId を確認。owner が stage を閲覧・download し、tgz の digest と source/run/tag を照合する。署名 bundle の取得・検証経路も確認し、署名・issuer / workflow identity・source commit・SHA512 subject・transparency inclusion を検証する。現在の stage receipt は bundle 自体を保存しないため、receipt だけで暗号検証完了とはしない。
6. この検証は最終 approve の手前で止める。失敗や曖昧な応答では owner が registry の pending state を確認してから再送する。成功後に、alpha を公開承認するか取り下げるかを別途判断する。

stage list / view / download / approve / reject の owner 操作は対話認証を使います。OIDC job に owner の最終承認を委譲しません。最終公開を承認した場合は、registry version、next tag、provenance と fresh consumer を別途確認します。
