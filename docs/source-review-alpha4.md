# alpha.4のソースレビューと整理候補

確認日: 2026-10-17 JST。対象sourceは `791c5a92e8ebcfa7f113d17051a5d13415c34f49`。公開tgzは106ファイル、SHA256は `c2912b6342278701838a60d2eaf98b6a1b2431772e5baa1e8cea547510eb265c`。

優先するのは、FormData引数の契約整理と、Markdown・component graphの重複解析の削減である。配布JS 21モジュールは公開入口と生成される入口から到達でき、一括削除できる未使用モジュールは確認できなかった。実装済みの防御処理を削るより、同じファイルやarchiveを繰り返し解析する箇所を整理する。

今回はレビューと再現計測までを行った。以下の改善案は未実装であり、速度改善後の値も未測定。[正式版ロードマップ](stable-roadmap.md)は対応順序と公開条件を定める。

## 優先度と影響する経路

| ID | 優先度 | 結果 | 影響する経路 |
| --- | --- | --- | --- |
| SR-1 | 高・API固定前に必要 | FormData引数を受け取るが、その値を送信しない | 公開form API、不要なFormData生成 |
| SR-2 | 高・最初の最適化 | Markdown一覧取得が全ページ走査を繰り返す | build/dev/HMR。requestのたびの処理ではない |
| SR-3 | 中 | 同じ共有component/layoutを別々に読む・解析する | build/dev/HMR |
| SR-4 | 中 | 共通のrelease準備を5つのmatrixで反復する | CIとrelease検証 |
| SR-5 | 中 | archiveの1ファイルごとにtarを起動し、同じarchiveを再度走査する | release検査とstage |
| SR-6 | 低・追加計測後に判断 | head同期とproject root処理を整理する余地がある | browser/head、plugin初期化 |

「高」は脆弱性の深刻度を表すものではなく、このリポジトリで先に取り組む順序である。

## SR-1: FormDataの型と送信内容を一致させる

[form.ts](../packages/hono-pages/src/runtime/form.ts)の14〜16行はFormData引数を受け付ける。一方、76〜84行ではstring以外のtargetをURLとして使わず、送信dataを`current.current`から作っている。[form-view.tsx](../packages/hono-pages/src/runtime/form-view.tsx)の18行は、urlを指定しないと毎回`new FormData(formElement)`を生成するが、この内容は送信に使われない。

実際のruntimeをHonoのSSR provider下で呼び、routerだけを記録用のstubにした再現結果:

```ts
const form = useForm('/save', { name: 'model-default' });
const submitted = new FormData();
submitted.set('name', 'from-form-data');
await form.post(submitted);
// router.visitへのdataは { name: 'model-default' }
```

この再現はnetworkを送信せず、公開型が受け付ける引数とtransportへ渡す値の差を確認したもの。既存consumerはcontrolled inputとJSONモデルを使うため、87件のテストが成功していてもこの差は残る。

修正前に、JSONモデル専用にするか、FormDataを送れるAPIとして扱うかを決める。専用なら引数の型と不要な生成を整理する。対応を残すなら値・File・重複field・Content-Type・validationの契約を実装する。受入条件は、公開型・Form component・送信bodyが一致し、cancel/duplicate/validationの既存動作も維持されること。

## SR-2: Markdownの一覧取得を走査から分離する

[hono-markdown.ts](../packages/hono-pages/src/plugins/hono-markdown.ts)の19〜30行で、`getClientScripts()`が毎回ディレクトリ全体を走査し、Markdownを読み直して解析する。[hono-islands.ts](../packages/hono-pages/src/plugins/hono-islands.ts)の101〜106行は、それをisland pageごとに呼ぶ。Markdownはstatic island pageとして検出されるため、ページ数に応じて全走査も増える。

実pluginの`buildStart()`を、同じ構成の合成Markdownページで実行した。fsの同期readとtree walkだけを一時的に数え、他processや実projectは変更していない。

| Markdownページ数 | 一覧getter呼び出し | 同期Markdown読み取り | tree walk |
| ---: | ---: | ---: | ---: |
| 10 | 10 | 120 | 10 |
| 50 | 50 | 2,600 | 50 |
| 100 | 100 | 10,200 | 100 |

このfixtureでのread数は `N² + 2N`。同じ100ファイルを100回一覧化する部分が支配的になる。最初に取り組む案は、getterをsnapshot取得だけにし、buildStartと変更通知で解析結果を更新すること。Pages/islandsで同じscan結果を共有する設計も、この後で検討する。

受入条件は、1世代の解析中にgetterが全走査せず、ページ数に対してread数が線形に増えること。Markdown追加・削除、script追加・削除、layout変更、symlink、複数Vite environment、static zero-script出力の回帰を確認する。cacheをprocess全体へ無期限に置かず、projectと更新世代で分ける。

## SR-3: graphの解析結果を一つの世代で再利用する

[hono-islands.ts](../packages/hono-pages/src/plugins/hono-islands.ts)の57〜94行には、static graphの探索とinteractive graphの検証がある。後者の`seen`は呼び出しごとに新しくなり、各pageとlayoutの共通依存を再度読む。`islandImports`と通常import探索でも同じsourceを複数回parseしている。

全pageとroot layoutが同じ1個のcomponentをimportする合成fixtureでは、100pageの`buildStart()`で共通componentを200回、root layoutを100回同期readした。10pageでは20回/10回、50pageでは100回/50回だった。

提案は、canonical pathをkeyにsource・AST・import一覧を1世代だけ保持し、static側とinteractive側で再利用すること。ただし両者の検証規則は分ける。interactive component内のisland import禁止を共通化で失わないようにする。96〜100行の固定点ループは、実規模で支配的なら逆参照graphのqueue処理へ変更する。計測していない速度向上率は約束しない。

循環import、directory index、re-export、named layout、shared componentの編集に加え、エラー後の修正と削除時のcache破棄を受入条件にする。

## SR-4: CIの共通処理を候補生成とconsumer検証に分ける

[package.yml](../.github/workflows/package.yml)の5構成は、すべて[release:prepare](../scripts/release/prepare.mjs)を実行する。その34行にあるroot監査、全履歴/secret scan、型、unit、Custom SSR、source browser check、package buildまで5回繰り返す。通常のPR更新はpushとpull_requestの両方でも実行される。

[main CI run 38998960321](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/38998960321)のbaselineとlatest-vp artifactを取得すると、両方のtgzが上記SHA256と一致し、sizeも96,528 bytesで同じだった。consumerの依存監査は各構成の結果なので、そこを一つに集約してはいけない。

提案構成は「共通検証・候補生成を1回 → 同じ候補を5構成で検証 → 結果を必須checkへ集約」。PRとpushの重複も、main・fork・bot release PRの起動経路を保って整理する。既存の必須check名と全構成成功の条件は維持する。

stageは、同じrun/attemptの受理済みartifactを再検証する現在の境界を残す。他runのartifactを無条件に使い回したり、公開直前のfresh auditを省略したりしない。CIの所要時間・費用削減率は未測定なので、PR前後で別途比較する。

## SR-5: archiveの内容を一度取得して検証に再利用する

[gate.mjs](../scripts/release/gate.mjs)の121〜140行は、106ファイルそれぞれを別の`tar -xOzf`で取得する。`inspectArtifact()`はさらに元source、license、changelogなどを個別取得する。[stage.mjs](../scripts/release/stage.mjs)はcreatePlan経由と明示的な検査を合わせ、送信前にこれを3回実行する。

実際のalpha.4 artifactを使い、child processを数えた結果は1回の検査で129個、3回で387個のtar起動だった。`inspectTarball()`は内容Mapを作っているが、返すのはファイル名一覧なので、呼び出し側が内容を再取得する構造になっている。

各検査時点でarchiveを安全に一括解析し、検査結果と内容Mapを内部で再利用する案を優先する。時点をまたぐbytesのSHA256/SHA512再照合は残す。path traversal、symlink/hardlink、重複entry、許可外ファイル、src/map一致、宣言・notices、archive改変の既存検査は減らさない。展開処理へ無検証のarchiveを渡さない。

## SR-6: 小さな整理は追加計測と対応範囲の判断後に行う

[document-head.ts](../packages/hono-pages/src/runtime/document-head.ts)の24〜26、43〜45、54〜56行では、findIndex中に属性のserialize/sortを繰り返す。signatureを先に計算する余地はあるが、通常pageのhead件数で支配的だとは測定していない。headの変更順序とinert scriptの保証を優先し、低い優先度に置く。

Pages/islandsはfactory呼び出し時の`process.cwd()`、Markdownは`configResolved`のrootを使う。現行の「project rootから実行」という条件内では不具合を再現していない。rootを共有contextにまとめるのは、別rootやmonorepoを正式にサポートするときの整理候補とする。

## 残す処理と、別に扱う整理

- providerの公開import identity、dev SSR snapshot、revision/commit待ち、abort/generation判定は、状態混在・古い応答・失敗後の復帰を防ぐためにある。短くする目的で削除しない。
- sourceとmapは利用者のdebug用の成果物。server/browserの出力は異なるJSX factoryが必要で、同じような見た目でも一方を削除しない。21モジュールの到達確認は文単位のdead-code証明ではないが、削除できるmoduleの根拠も得られなかった。
- fixturesの5 lockfileとparser lockは再現性のために残す。tests・examples・docsはnpmのfiles allowlistに入らず、削除しても配布サイズは減らない。
- 元のvoid-pocに残るReact starter依存や説明・Node CIは[#61](https://github.com/ts-76/void-plugin-hono-jsx/issues/61)で整理する。アダプター本体のruntime依存とは分ける。
- alpha.0のstage記録などは履歴として保持する。文書の入口をまとめる変更は可能だが、過去source/run/versionを現在の実績へ書き換えない。

## 計測の範囲と次のPR

計測はNode 24.21.0 / macOS arm64の単独processで、合成10/50/100pageと実際のalpha.4 tgzを使用した。fs/child_processのexportをそのprocess内だけで一時的に差し替え、実pluginの呼び出し回数を数えた。cache変更後の数値、productionのCPU/p95、Linux CIの費用改善、実利用者のpage規模は未測定である。今回の結果を改善率として公表しない。

再現する場合は、全pageに先頭client scriptを持つMarkdownを用意し、Markdown pluginのconfigResolved後にislands pluginのbuildStartを実行する。共有graphは各TSX pageとroot layoutから同じcomponentをimportする。archive検査は[stage prepare run 38999037311](https://github.com/ts-76/void-plugin-hono-jsx/actions/runs/38999037311)の受理済みtgzとaudit/evidenceを使い、`inspectArtifact()`を3回呼ぶ。FormDataの再現はSR-1のとおりで、routerの送信境界だけを記録する。

次のPRはSR-1のAPI契約整理から始める。最新Voidへのconsumer追加を別PRにし、その検証を基準にSR-2/SR-3を進める。SR-4/SR-5はreleaseの保護条件を保った独立PRとし、今回の文書変更には実装修正を含めない。
