# pnpm 公開ジョブの依存評価と採用条件

2026-10-21時点の対象は **pnpm 11.28.6のJavaScript配布物、Node 24.21.0、Linux x64** です。固定した受入済みtgzを `stage publish` する処理だけに使用します。開発・ビルド・候補作成のパッケージマネージャーは変更しません。

## 残る指摘と判断

配布archiveのintegrityを照合し、454ファイルのSHA256表と、バンドル内の版付きmodule pathおよび同梱package.jsonから抽出した370パッケージ・バージョンを固定しました。各回のCIと公開ジョブでOSVへ再照会します。

残る指摘は **braces 3.0.3 / [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)** の1件です。深いbrace patternの解析・AST走査によるstack exhaustionが条件です。Highの指摘は残っており、audit 0ではありません。

今回のソース追跡と実行計測から、下記の固定経路に限って採用可能と判断しました。利用者は、この評価で問題がなければ11.28.6へ切り替えて公開を進めることを指示しています。この判断は任意のpnpmコマンドや入力へは拡張しません。

```text
stagePublish
  → publish2（workspace/recursiveとgit checksは無効）
  → 明示した .tgz を判定
  → publishTarball
  → extractPublishManifestFromPacked（gzip/tarを読む）
  → publishPackedPkg（元のbytesを読む）
  → OIDC / libnpmpublish / Sigstore
  → staging endpointへPOST
```

`publishDir`、directory pack、install、workspace glob探索はこの分岐に入りません。CLI引数はコードで固定し、受け入れ済みtgzのファイル名・manifest・内容も事前に検証します。外部入力をbrace patternに渡す処理は、この経路の追跡では見つかりませんでした。

## 動的な確認

`probe-publisher-js.py` は **未変更のCLI** をLinux network namespaceの中で実行します。loopback以外の通信と本物のcredentialは使いません。ローカル開発では別のsocket guardを使い、Linuxの隔離と区別します。

通常stage、OIDC応答のtoken欠落、provenance署名失敗、stage応答500、dry-runの5ケースで、V8 coverageからbracesの各関数を確認します。module初期化は発生しますが、parse/compile/expandを含む関数呼び出しは0です。別のprefix copyで小さい正常patternをparse/compile/expandし、同じ計測が実行を検出するpositive controlも要求します。copyは計測の対照専用で、公開CLIには使いません。

正常fixtureではstage POST 1回とtarball bytes・integrity・tag・accessの一致、lifecycleと直接publishがないことを確認します。CLI単独ではOIDC token欠落時に無認証POSTを試みるため、従来どおりNode側のmandatory OIDC preflightがCLI起動前に失敗させます。署名失敗ケースは署名成功の証明ではありません。本物の署名付きstageと公開物はリリースごとに別途検証します。

実stageでもV8 coverageを専用一時ディレクトリに記録し、CLI終了後にbracesの関数呼び出しが0であることを確認します。予期しない呼び出しや計測欠落があれば完了扱いにせず、stageの自動再送・owner承認へ進みません。

## 維持する境界

- archive SHA512、全配布ファイルのSHA256と集合、CLI entryのSHA256、抽出inventoryを照合。install、lifecycle、override、bundle改変は行いません。
- advisoryのcrate相当のpackage/version/ID、modified、内容全体のhashを固定。新規・変更・消失・pagination・不完全な応答で停止します。
- HOME/XDG/config/cache/storeを専用領域へ隔離。既存login・token・proxy・NODE_OPTIONSは継承しません。userconfigには直前のpackage-scoped OIDC tokenだけをmode 0600で置き、成功・失敗とも削除します。
- `--ignore-scripts --ignore-workspace --no-git-checks --provenance` と固定tgzを使用。source/tag/artifact/evidence、protected environment、管理者bypass禁止、ownerの最終2FA承認を維持します。
- 対象版、Node、platform、配布物、コマンド、入力範囲、指摘内容が変われば再評価します。全エラー分岐や任意の外部入力に対する非到達性の証明ではありません。

## 12系から変更した理由

12.14.0のrustls-webpki 0.103.15にRUSTSEC-2026-0382が追加され、公開ゲートが停止しました。11系のJavaScript実装はこのRust依存を使用しません。12系で受け入れたRust/ZIPの7件は今回のpolicyから外し、新しい配布物を別に評価しています。

以前の評価は[変更前の文書](https://github.com/ts-76/void-plugin-hono-jsx/blob/6fc417cc6e1109eedb90c6d482ab5ef5fe3cbefa/docs/pnpm-publisher-assessment.md)に残っています。npmとの過去の比較は[publisher-security.md](publisher-security.md)を参照してください。
