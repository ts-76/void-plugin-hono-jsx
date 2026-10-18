# Release Please

Release PleaseはConventional CommitsからリリースPRを更新します。
設定は `versioning: default`、`prerelease: false` です。固定の `release-as` は使いません。

## 管理するファイル

| ファイル | 役割 |
| --- | --- |
| `.release-please-manifest.json` | リリースバージョン |
| `package.json` / `package-lock.json` | 開発用rootのバージョン |
| `packages/hono-pages/package.json` | 公開パッケージのバージョン |
| `CHANGELOG.md` | 変更履歴の正本。ビルド時にパッケージへコピー |

バージョンと変更履歴はbotに更新させます。破壊的変更には `!` と移行案内を付けてください。

## CIとmain保護

標準の `GITHUB_TOKEN` を使います。追加PATやnpm tokenは不要です。
自動approveとmain保護のbypassは行いません。

botが作成・更新したPRには、release workflowから `package.yml` と `publisher.yml` を明示dispatchします。
PRの最終headで必須チェックを確認してください。GitHub側でworkflowが承認待ちの場合はownerが内容を確認して承認します。

再実行が必要な場合:

```sh
gh workflow run package.yml --ref release-please--branches--main--components--void-plugin-hono-jsx
gh workflow run publisher.yml --ref release-please--branches--main--components--void-plugin-hono-jsx
```

## 公開までの流れ

1. 変更をまとめてmainへマージする。
2. botが更新したリリースPRのversion・notes・必須CIを確認してマージする。
3. 作成された `v<version>` tagとsource、main CIを確認する。
4. 承認したtagでnpm stageを手動実行する。同じrun/attemptの成果物を確認してenvironmentを承認する。
5. stage後にgateをfalseへ戻し、npm ownerが最終Approveを行う。
6. 公開物・署名/provenance・consumerを確認し、通常版のlatestとnextを揃える。RCはnextのみ更新する。

GitHub Releaseの作成だけではnpm公開は完了しません。
stageは自動実行せず、[公開手順](releasing.md)と[チェックリスト](release-checklist.md)に従います。

[Release Please Action](https://github.com/googleapis/release-please-action) · [Manifest設定](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)
