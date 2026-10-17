# 正式版に向けたロードマップ

確認日: 2026-10-17 JST。対象は公開済み `0.1.0-alpha.4` と、そのソース `791c5a92e8ebcfa7f113d17051a5d13415c34f49`。

正式版への昇格は、最新Voidへの互換性、フォームの公開契約、本番Workersでの動作を確認してから判断する。機能を一通り実装する段階は進んでいるが、alphaを外すだけで本番対応済みとは扱えない。版番号は調査後に決めるというmaintainerの方針に従い、この計画では未確定とする。

本書は作業順序と完了条件の提案である。実装、デプロイ、npmタグ、公開ポリシーは変更していない。処理の整理候補と計測方法は [ソースレビュー](source-review-alpha4.md) にまとめた。

## 最初に、対象とするVoidの版を更新する

使用しているnpmパッケージの上流は [voidzero-dev/void](https://github.com/voidzero-dev/void)。以前参照された [Void-Framework/Void](https://github.com/Void-Framework/Void) はKotlin／HTMXの別フレームワークであり、このアダプターの互換性根拠には使わない。

| 対象 | alpha.4で検証した構成 | 今回registryで確認した最新版 | 次に必要な作業 |
| --- | --- | --- | --- |
| Void | 0.26.1 / 0.27.0。peerは `>=0.26.1 <0.28.0` | 1.1.11 | 最優先で移行調査と新しいconsumer検証 |
| Vite Plus | 0.1.24 / 1.1.0 | 1.3.0。core同梱Viteは8.3.4 | scaffoldとaliasを更新し、実際のhook版を確認 |
| Vite | 8.0.16 / 8.3.3 / 8.3.4 | 8.3.4 | plain Viteの検証を維持 |
| Hono | 4.13.13 | 4.13.13。nextは5.0.0-rc.1 | 4系を対象とし、5系は別途評価 |
| Markdown parser | markdown-exit 1.3.0 / yaml 2.9.1 | 同じ | optional peerの分離を維持 |

出典: [Void](https://registry.npmjs.org/void/1.1.11)、[Vite Plus](https://registry.npmjs.org/vite-plus/1.3.0)、[Vite Plus core](https://registry.npmjs.org/@voidzero-dev%2fvite-plus-core/1.3.0)、[Vite](https://registry.npmjs.org/vite/8.3.4)、[Hono](https://registry.npmjs.org/hono/4.13.13)、[markdown-exit](https://registry.npmjs.org/markdown-exit/1.3.0)、[yaml](https://registry.npmjs.org/yaml/2.9.1)のregistry metadata。この表は確認日の記録であり、将来の最新版を保証しない。fixture名の `latest-*` は2026-10-12の固定スナップショットである。

Void 1.1.11の公式tarballをintegrity照合して公開宣言を比較したところ、利用中のPages関連import名は残っていた。`pages-client` の入口宣言では参照chunk名以外の差分はなかった。ただし、参照先の全実装・仮想module契約・実行時挙動の互換性は未検証であり、型名の一致だけでpeer範囲を広げない。

公開APIが残っていても、`virtual:void-pages-renderer`・`virtual:void-pages-client`・`__VOID_PAGE_DATA__`・`void-md`のplugin名やasset処理は版ごとの連携規約に依存する。これらを契約テストで固定し、上流の登録方式が変わった場合に検出できるようにする。

## 現在の実績と残件を区別する

alpha.4はnpm公開済みで、公開tgzとstageのbytes、registry署名、provenanceのsource/runを照合済み。既存CIでは5構成のconsumerが通過し、今回も単体テスト87件が成功した。元のvoid-pocでもNode 24.21.0、Void 0.27.0、Bun 1.3.13、Vite Plus 1.1.0で型・dev・build・preview・SSR・API・カウンターを確認している。

公開済みコードにはLink/Form、navigation state、island form、island graph/policy、deferred、page options、optional Markdownが含まれる。関連する機能Issue #48〜#56は完了済み。残っている既存Issueは次の5件で、新たに同じIssueを起票する必要はない。

| Issue | 正式版での扱い |
| --- | --- |
| [#57 Workersへの実デプロイ](https://github.com/ts-76/void-plugin-hono-jsx/issues/57) | Cloudflare本番対応を宣言する場合の必須条件 |
| [#58 本番ISR・cache境界](https://github.com/ts-76/void-plugin-hono-jsx/issues/58) | 本番ISRを正式サポートする場合の必須条件。範囲外とする選択も可能 |
| [#59 dist-tag](https://github.com/ts-76/void-plugin-hono-jsx/issues/59) | 正式版の公開前に方針を確定する |
| [#61 検証projectの依存・CI整理](https://github.com/ts-76/void-plugin-hono-jsx/issues/61) | 公式な導入例として案内する前に完了する |
| [#62 既知の制約・監査・更新方針](https://github.com/ts-76/void-plugin-hono-jsx/issues/62) | 正式版のサポート条件として整備する |

#60はalpha.3向け文書整理として完了済みだが、alpha.4の公開実績と今回の対応方針は新しい文書更新が必要。旧versionのstage記録を書き換えて新versionの証拠にはしない。

## 実装・検証・公開の順に条件を満たす

| 順序 | 作業 | 完了条件 | 依存・判断 |
| --- | --- | --- | --- |
| 1. 契約を決める | Void 1.1系を中心に、維持する旧版・API・出力方式を定義する | 公開exports、対応環境、フォーム送信、Markdownの信頼境界、非対応機能の一覧がある | 0.26/0.27系を維持する保守負担を選ぶ |
| 2. APIの不整合を直す | `post(FormData)` の挙動を定義し、実装または型を修正する | 引数の値を無視しない。型と実際の送信内容が一致する。回帰テストがある | ソースレビューのSR-1。公開API固定前に必須 |
| 3. 最新版を検証する | Void 1.1.11とVite Plus 1.3.0のfixtureを追加し、必要な実装修正を行う | fresh install、生成型、dev/build/preview、browser、static、選択したislands/deferred/Markdown機能が通る。監査も評価済み | 既存の版チェックは成功するまで維持する |
| 4. 重複処理を減らす | Markdownの全走査とgraph解析を整理する | 100ページ以上でもgetterごとの全走査がなく、編集・追加・削除・symlink・layout変更に追従する | SR-2/SR-3。tar/CIの整理は独立PRにする |
| 5. 本番を確認する | 合成データの専用Worker/D1で実デプロイを検証する | 実URLでSSR/assets/API/D1/action/validation/navigation/layout/headが成功。migrationと再deployも確認する | #57。account、resource名、費用・保持方針を確定してから実行 |
| 6. ISRの範囲を確定する | 本番ISRを検証するか、正式版の対象外と明記する | 採用する場合はHTML/Pages JSON、認証境界、purge、並行再生成、障害回復を確認する | #58。ローカルHIT/MISSの結果だけで本番保証しない |
| 7. RCを固定する | 新APIの導入文書、clean consumer、release設定、監査記録を揃える | 未修正の重大な不具合がなく、対応構成の全必須CIが同じheadで成功する。npm RCの公開物も検証する | version番号と対応範囲をこの時点までに選ぶ |
| 8. 正式版を公開する | release PR、tag、同じrunのstage、owner approve、公開後検証を進める | 宣言したstable version/tag、公開bytes、署名/provenance、registry-installed consumerが一致する | 個別の公開承認と既存の保護環境を維持する |

最新Voidへの移行と処理の最適化を一つのPRに詰め込まない。まず互換性の不具合を区別できる状態を作り、その後に同じconsumerを使って最適化の回帰を確認する。計測結果は [SR-2〜SR-5](source-review-alpha4.md) を参照。

## 初回正式版は機能の範囲を絞っても成立する

提案する中心範囲は、loader付きSSR、SPA navigation、layout/head、JSONによるform/action、標準island policy、明記したMarkdown構文である。公式adapterの全機能を初回から揃える必要はない。

DOMを再利用するhydration、状態を保持するHMR、Markdown内の任意JSX式、Shiki・footnotes・theme、MarkdownのSPA化は後続に回せる。deferred island、static deferred、failed-prefetchのerror伝達は、実装するか非対応として契約を明確にする。static出力で非対応routeを省略してbuildが続く挙動は、アプリ側で成果物不足を検出できるかも確認する。

本番ISRを外す場合は、README・例・検証matrixに同じ境界を記す。team-managed Void platform、未検証OS・Node majorを対象に含める場合も、別の検証結果が必要になる。

## 版番号と公開ポリシーはRCまでに選ぶ

[SemVer 2.0.0](https://semver.org/spec/v2.0.0.html)では、0.xは初期開発であり、1.0.0が公開APIを定義する。alpha表記を外した0.1.0と、API互換性を約束する1.0.0は分けて判断する。

推奨は、上記の条件を満たすまではalphaを継続し、APIと対応版を固定できた時点で1.0.0を選ぶ方針。早期に0.xの通常版を出す場合は、破壊的変更の扱いを明文化する。現時点ではどちらも採用済みとは扱わない。

| 決定項目 | 推奨する方向 |
| --- | --- |
| 対応Void | 現行1.1系を優先。旧0.xは検証結果と保守負担を見て維持・終了を決める |
| FormData | JSONモデル専用とするか、FormDataを送るAPIとして実装するかを先に決める |
| 正式版のdist-tag | RC/alphaはnext、正式版は公開検証後にlatestへ。nextの追従方針も記録する |
| 既存の監査例外 | alphaでの受け入れを正式版へ自動継承せず、最新の依存・publisher・実行条件で再評価する |
| セキュリティ窓口 | CONTRIBUTINGに現在ないprivate reporting経路と対応対象版を定める |

正式版を選んだら、Release Pleaseの`versioning: prerelease`・`prerelease`・`prerelease-type`を整合させ、GitHub Releaseのprerelease属性も解除する。[release-policy.json](../release-policy.json)と[package metadata](../packages/hono-pages/package.json)のdist-tagを揃え、stable/prereleaseの取り違えをgateのテストで防ぐ。今回これらの設定は変更していない。

## 直近はAPI契約と新版fixtureを先行する

次の実装単位は「FormData契約の整理」と「Void 1.1系／Vite Plus 1.3.0のconsumer追加」を分けたPRとする。その結果をもとに対応範囲を確定し、Markdown/graph最適化、本番検証、RCへ進む。監査が未承認の旧scaffoldを残す場合は、機能CIの成功を正式サポートの根拠にしない。

調査方法: 現行source/exports/test/CI設定、GitHubの全Issue状態、公開npm metadata、Void 1.1.11の検証済みtarball、alpha.4 CI artifactを読み取った。最新版での実行、新規Cloudflareデプロイ、production負荷測定は今回行っていない。工数や日付は、移行の実測とデプロイ対象の決定後に見積もる。
