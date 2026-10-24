# pnpm 公開ジョブの依存評価と採用条件

2026-10-21時点の対象は **pnpm 11.28.6のJavaScript配布物、Node 24.21.0、Linux x64** です。固定した受入済みtgzを `stage publish` する処理だけに使用します。開発・ビルド・候補作成のパッケージマネージャーは変更しません。

## 2026-10-24 reassessment: new undici advisories block publication

**Decision: keep publication blocked; no new accepted findings.** The earlier zero-finding observation below predates the refreshed advisory data. The current complete OSV query over the same 370 package/version entries reports five package/version/advisory matches, representing three distinct advisories:

| Package | Advisory | Current assessment |
| --- | --- | --- |
| undici 6.29.0 and 7.29.1 | [GHSA-4qv8-2p9j-2685](https://github.com/advisories/GHSA-4qv8-2p9j-2685), EventSource memory exhaustion | No EventSource function calls observed in the five fixed-stage protocol cases. Potential scoped acceptance only; not approval of arbitrary commands or EventSource users. |
| undici 7.29.1 | [GHSA-f72v-6w45-q472](https://github.com/advisories/GHSA-f72v-6w45-q472), mixed-case SRI bypass | Requires fetch integrity metadata with a mixed/uppercase algorithm. The reviewed stage path does not use that feature; archive SHA512/SHA256 checks use Node crypto separately. Potential scoped acceptance only; no claim that SRI itself is safe. |
| undici 6.29.0 and 7.29.1 | [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c), unhandled response-stream error | **Reachable.** The bundled 7.29.1 fetch runs during fixed-tgz staging. A malformed fake OIDC exchange response terminates the unmodified CLI, even on patched Node 24.22.1. Do not accept this as an unused dependency. |

All 454 pinned distribution files were rechecked against the committed SHA256 table. The CLI entry remains `5d2cac585f73db48e086a4391e817e09503cd9b6b5345b864ea52a70a2d3fffe`; no distribution code was patched. The five existing loopback protocol cases passed on Node 24.21.0. V8 coverage of the original CLI recorded two bundled undici 7 fetch calls and two `httpNetworkFetch` calls in each case; EventSource calls and separate undici 6 fetch calls were zero. These are macOS observations using the socket guard, not renewed Linux namespace validation or successful real signing.

A separate negative case returned six content codings and closed the fake OIDC token-exchange response before its declared body. With Node 24.22.1, the CLI exited 1 with `UND_ERR_RES_CONTENT_LENGTH_MISMATCH` from the bundled undici parser and no stage POST. This establishes a reachable availability failure. It does not demonstrate credential disclosure, archive modification or a successful malicious publication. Fixed HTTPS authorities and TLS reduce the set of possible malicious peers, but do not make the affected parser unreachable. Any future acceptance would need to explicitly assess interrupted/ambiguous submissions, prohibit automatic resubmission and require registry reconciliation before retry or owner approval; that acceptance has **not** been granted here.

The pnpm 11.28.8 candidate is not a fix: its separately verified 369-entry inventory contains undici 6.29.1 **and** 7.29.1, retaining all three advisories on the latter. It was not adopted. The official npm registry still labels 11.28.6 `latest-11` and 11.28.8 `next-11` at this check.

The runner is also affected independently: Node 24.21.0 embeds undici 7.29.1. Local response tests reproduced both the unhandled-error exit and mixed-case SRI bypass with its built-in fetch. [Node 24.22.1](https://nodejs.org/en/blog/release/v24.22.1) embeds fixed undici 7.30.1; the identical tests caught the malformed response without a process crash and rejected both SRI case variants. The official macOS arm64 archive was checked against its published SHA256, `89c682593d76cd44233fa53b1563264e7de9cbb189cad169135c5b4fadfbc0a7`. Updating Node alone does not replace pnpm's bundled undici.

### Safe publication direction

1. Move the supported Node 24 baseline and all release/CI pins to a security-fixed version (24.22.1 is the verified candidate). Reassess the Linux x64 publisher under that exact runtime. This is required even if a publisher exception is later considered.
2. Prefer an upstream publisher distribution containing undici >=6.29.1 and >=7.30.1 for the respective major lines. Verify its archive, source, every distributed file and complete inventory. Do not replace bundled files, add transitive overrides, disable provenance or reuse old finding acceptance.
3. If that distribution is unavailable, retain the block. A different publisher is a separate candidate requiring full source/inventory/OIDC/stage/provenance review. The present review does not select or approve an alternative CLI.
4. Resolve or narrowly reassess the separate [consumer findings](rc-security-assessment.md#2026-10-24-follow-up-void-121-consumer-and-runner-findings). Any accepted finding must pin package/version/advisory modified/content hashes and explicit execution conditions. Reappearing, changed or additional findings continue to fail closed.
5. Repeat the five protocol cases, malformed-response check, positive controls and real-stage coverage on Linux; then repeat final-head/main CI and both consumers on identical accepted bytes. Carry the official HTTPS Ubuntu mirror setup into `npm-stage.yml` before staging. Preserve the protected environment, mandatory OIDC preflight, provenance and npm-owner final approval, followed by public byte/signature/provenance/consumer verification.

The local diagnostic is `node scripts/release/probe-response-security.mjs [absolute-undici-entry ...]`. It uses only loopback responses, bounded child processes and small invalid arrays; run it with both old and candidate Node versions. It reports observations and deliberately does not modify the acceptance policy or turn a successful diagnostic run into publication approval.

For the unmodified CLI itself, run `PNPM_RELEASE_NODE=<node> python3 scripts/release/probe-publisher-js.py <verified-cli> <report-directory> --local --malformed-oidc`. The sixth optional case records `unhandledStreamError` and requires that the malformed exchange never reaches stage POST. Both a caught rejection and an unhandled stream error stop submission; the report distinguishes them. This does not replace the real runner's mandatory preflight. Use the existing Linux namespace invocation without `--local` when renewing target-platform evidence.

## Earlier 2026-10-24 observation: withdrawn braces advisory

GitHub [withdrew GHSA-vfj7-8cjw-p6xm on 2026-10-23](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), stating that it is not a practically exploitable vulnerability. The fresh OSV query for the pinned 370-package inventory returns no findings. The exact-set gate correctly stopped when its previous one-finding expectation disappeared.

Remove that advisory from `acceptedFindings`; the current policy requires zero findings. Keep the pinned distribution, inventory and file hashes, fixed staging command, OIDC/provenance, owner approval, isolation and braces reachability checks. A new finding or a reappearing advisory still stops the gate. The 2026-10-21 assessment below is historical; the consumer esbuild advisory is separate and remains reported.

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
