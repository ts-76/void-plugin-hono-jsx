# Release Please によるリリース管理

release-please-action v5.0.0 を commit SHA で固定しています。main への push または手動実行で、Conventional Commits からリリースPRを作成・更新します。root component は1つだけで、公開済み `0.1.0-alpha.0` と source `1805f4f88b74962d821039f20ca881fed639de85` を初期基準にします。既存の alpha.0 tag と公開 bytes は維持します。

## 管理するファイル

- `.release-please-manifest.json`: 現在のリリースversion。
- `package.json` と `package-lock.json`: private な開発用rootも同じversionに同期。
- `packages/hono-pages/package.json`: `extra-files` の JSON updater が version のみを更新。private / peer ranges / publishConfig は維持。
- `CHANGELOG.md`: 唯一の正本。package build が同じ内容を package にコピーし、tarball gate が byte単位で照合。package側のコピーは生成物としてGitから除外。

正式版は `versioning: default`、`prerelease: false` を使い、`prerelease-type` と固定の `release-as` は設定しません。tagは `v<version>`、GitHub Releaseは通常版として作成します。初回の `Release-As: 0.1.0` はPR #110で反映済みです。今後の修正・文書変更は通常のパッチ版として集約し、manifestやchangelogはbotが更新します。

## main保護とCI

release-please は標準 `GITHUB_TOKEN` を使い、追加PATやnpm tokenは不要です。repository の Actions にPR作成を許可し、default workflow permissionはreadのままです。release jobだけに contents / issues / pull-requests / actions write を付与します。自動approveやmain保護のbypassは実装しません。

GitHubではGITHUB_TOKEN由来のPR用CIが手動承認待ちになる場合があり、通常のpushで次のworkflowが起動するとは限りません。release jobは作成・更新したPRのauthor、repository、base、branch、pending labelを検証し、そのbranchに `package.yml` と `publisher.yml` を明示dispatchします。長期tokenを追加せず、main保護の必須チェックを生成したheadで実行します。失敗はworkflowを失敗にし、CI成功として扱いません。[GitHubのworkflow起動仕様](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)

CI失敗時はrelease PRを修正・更新して両チェックを再実行してください。必要なら `gh workflow run package.yml --ref release-please--branches--main--components--void-plugin-hono-jsx` と `gh workflow run publisher.yml --ref release-please--branches--main--components--void-plugin-hono-jsx` で実行できます。GitHub側に承認待ちのPR workflowが表示される場合は、内容を確認してownerが承認します。latest mainへの追従と未解決コメントの解消も必要です。

## リリースの順序

1. Conventional Commitの変更をmainへマージし、release-pleaseが更新したrelease PRのversion・notes・互換性を確認する。
2. 必須CIが通過したrelease PRをmaintainerがマージする。release-pleaseがそのmerge commitの `v<version>` tagとGitHub Releaseを作成する。通常版設定ではprerelease属性はfalseになる。GitHub Releaseはnpm公開完了の証拠ではない。
3. tagとsourceを確認し、承認済みの候補に限って `NPM_STAGING_ENABLED=true` にし、そのtagの `npm-stage.yml` を手動実行する。
4. 同じrun/attemptのprepare artifactを確認してnpm-stage environmentを承認する。pnpm / OIDC / provenance / fresh auditの既存gateを通す。
5. 成功後にrepository gateをfalseへ戻す。npmサイトでownerが最終approveし、公開bytes・next tag・署名/provenance・consumerを検証する。
6. 公開物の検証後、承認された通常版にlatestとnextを揃える。dist-tag変更にはownerのwrite認証と追加2FAが必要になる。RCはnextだけを更新する。

release-pleaseからnpm-stageを自動dispatchせず、npmの最終approveも行いません。依存監査・publisher監査・source/history検査・environment reviewを維持します。送信bundleの承認前検証は引き続き別の取得・保持経路が必要です。[既存の公開手順](releasing.md)、[初回の実検証](stage-validation-result.md)

[Release Please Action](https://github.com/googleapis/release-please-action)、[manifest設定](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)

## 初回正式版の完了と次のパッチ版（2026-10-18）

PR #110は `0.1.0` としてマージ済みです。通常のGitHub Release、OIDC/provenance付きstage、npm ownerのApprove、公開物・両registry consumerの検証、latest/next=0.1.0への整合まで完了しました。[公開記録](releasing.md#010-publication-and-tag-verification)を参照してください。実Workers/D1検証・撤去はRC.1で実施した記録です。

Issue #59のREADME・公開案内の訂正は、公開済み0.1.0を上書きせず、次のパッチ版に含めます。文書PRをCI確認後にマージし、botが作る次のリリースPRでversion・notes・同梱READMEとCIを確認します。この準備ではリリースPRのマージやstageを行いません。通常版も最初はnextへstageし、公開物検証後にlatestとnextを同じ版へ揃える手順を維持します。`NPM_STAGING_ENABLED=false` のまま、[公開契約](release-contract.md)と[チェックリスト](release-checklist.md)に沿って進めます。
