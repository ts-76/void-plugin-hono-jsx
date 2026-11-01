# pnpm 12 公開用CLIの評価 — 2026-10-26

対象は **pnpm 12.15.0、Linux x64 GNU版、受入済みの固定tgzをstageする用途**です。開発時のinstall・lockfile移行・性能比較は対象に含めません。

**判断：評価候補として継続できますが、現時点では採用しません。** 対象の依存グラフと公式配布物の出自を確認し、macOSとLinux/amd64コンテナで公開プロトコルを検証しました。対象グラフに未受入のadvisoryが残り、本物の署名成功は未検証です。現在のnpm publisherとその許容条件は変更していません。

## 配布物とソースの対応

- 公式npmレジストリの`@pnpm/exe.linux-x64@12.15.0`と`@pnpm/exe.darwin-arm64@12.15.0`を取得し、archive全体のSHA512 integrityと各ファイルのSHA256を確認しました。installやlifecycleは実行していません。
- LinuxバイナリのSHA256は`8cca52dc2aab0081ac153a3c7ad36224cd72b6d7cfea413746b7b97f6a3d8942`、macOS版は`d9c23be5ad12e3e31faf6bdbe8c1566f642eddd03d915bfc0b9ab46120c8a521`です。
- Linux配布archiveのprovenanceをSigstoreの信頼ルートで検証しました。証明書のissuerは`https://token.actions.githubusercontent.com`、identityは`https://github.com/pnpm/pnpm/.github/workflows/release.yml@refs/tags/v12.15.0`に限定し、subjectのSHA512を取得済みarchiveと照合しています。
- 証明されたソースコミットは[`91774e72a04d52ce61db06339696a433d383c764`](https://github.com/pnpm/pnpm/tree/91774e72a04d52ce61db06339696a433d383c764)です。取得したソースarchiveについて、ファイル内容・実行属性・symlinkからGit treeを再計算し、このコミットのtree `38382ec64192f548d2231fa937514c533b83ae41`と一致しました。
- 公式release workflowは`--locked -p pnpm-cli --bin pnpm --release --target=x86_64-unknown-linux-gnu`でビルドします。今回の依存評価は同じpackage・target・default featuresを使用しています。

これは公式pnpm配布物に付いている証明の確認です。このプロジェクトがpnpmを使って署名・公開に成功したという証拠ではなく、ソースからの再現ビルドも行っていません。

## 依存監査の絞り込み

前回のCargo.lock全体の779 registry package/version・20 advisory IDという結果には、別プロジェクトのレジストリサーバーやdev依存も含まれます。

今回はCargo 1.97.0で次のグラフを解決しました。crateのコンパイルやbuild scriptの実行は行いません。

```sh
cargo tree --locked --target x86_64-unknown-linux-gnu -p pnpm-cli \
  --edges normal,build --prefix depth --format '{p}'
```

このグラフのregistry package/versionは**493件**で、全件をOSVに再照会した結果は**7 crate・9 advisory IDの一致**でした。応答数、不完全な結果、pagination、各advisoryのIDとmodifiedを確認し、内容のhashを記録しています。

`bincode`、`event-listener`、`h2 0.3.27`、`libsql-sqlite3-parser`、`quinn-proto 0.11.14`、`webpki-roots 1.0.8`に対する計11 IDは、このグラフに含まれていません。したがって前回の20件を、そのまま公開用CLIの問題数として扱うのは不適切です。

残る一致の内訳と、今回確認できた範囲は次のとおりです。

- **anyhow 1.0.102 / [RUSTSEC-2026-0190](https://rustsec.org/advisories/RUSTSEC-2026-0190.html)**：`sigstore-sign → sigstore-oidc → ambient-id → astral-reqwest-middleware`経由でグラフに入ります。影響対象の`Error::downcast_mut()`までの実行到達性は未確定です。
- **crypto-bigint 0.5.5 / [RUSTSEC-2026-0387](https://rustsec.org/advisories/RUSTSEC-2026-0387.html)**：`p256 → elliptic-curve`経由です。秘密値を使う演算のタイミング差に関する問題で、実際の影響はアルゴリズム・compiler・CPU・観測条件に依存します。provenanceの一時鍵生成については、`sigstore-sign → sigstore-crypto`が`aws-lc-rs`を使う実装を確認しました。「P-256署名だからこのcrateを必ず使う」とは判断していません。ほかの鍵処理を含む非到達性は未証明です。
- **proc-macro-error2 2.0.1 / [RUSTSEC-2026-0173](https://rustsec.org/advisories/RUSTSEC-2026-0173.html)**：`tabled → tabled_derive`経由のproc-macro依存です。メンテナンス停止の通知であり、この一致だけで配布バイナリに実行時の脆弱性があることを示しません。
- **rsa 0.9.10 / [RUSTSEC-2023-0071](https://rustsec.org/advisories/RUSTSEC-2023-0071.html)**：`pnpm-engine-pm-yarn-resolver → pnpm-crypto-shasums-file → pgp`経由です。固定tgzのstageでRSA秘密鍵による復号処理を呼ぶ経路は今回確認していません。任意のinstallや鍵処理まで安全という結論ではありません。
- **tokio 1.53.1 / [RUSTSEC-2026-0386](https://rustsec.org/advisories/RUSTSEC-2026-0386.html)**：CLI・publishの直接依存です。指摘対象は`AsyncFd`のconstructorとファイル記述子の寿命です。Tokioで通信したという事実だけでは該当APIの使用を意味せず、全transitive依存を含む実行到達性は未確定です。
- **xxhash-rust 0.8.15 / [GHSA-6g2r-675j-hx59](https://github.com/advisories/GHSA-6g2r-675j-hx59)**：`ssri`経由です。指摘は短すぎるcustom secretを受け取るAPIに関するものです。`ssri 9.2.0`は`Xxh3::new()`を使用し、確認した呼び出し箇所ではcustom secretを渡していません。これは全バイナリの呼び出し計測ではありません。
- **zip 8.6.0 / [RUSTSEC-2026-0367](https://rustsec.org/advisories/RUSTSEC-2026-0367.html)、[0368](https://rustsec.org/advisories/RUSTSEC-2026-0368.html)、[0369](https://rustsec.org/advisories/RUSTSEC-2026-0369.html)**：`pnpm-tarball`経由で、ZIP展開時の権限・symlink処理に対する3 IDです。固定tgz公開では`extract_publish_manifest_from_packed`がgzip/tarを読み、元のtgz bytesを送ります。今回のprotocolケースはZIP展開を必要としません。install・Python配布物などのZIP処理は評価対象外です。

この結果は**対象ソースの通常依存・ビルド依存グラフ**です。LTO後のバイナリに残る関数のSBOMや、9件の悪用可能性を示すものではありません。またGitで固定された`dashmap`・`node-semver`と、vendored `tar`はregistry-only OSV照会の対象外として明示しています。これらを含む完全なバイナリ監査が完了したとは扱いません。例外承認は追加していません。

## macOSとLinuxでの動的検証

未変更の公式macOS arm64バイナリを使用しました。HOME・config・cacheを一時領域に分離し、環境変数を組み直して実credentialやproxyを継承せず、`sandbox-exec`で外部通信を禁止しています。外部IPへの接続が`Operation not permitted`になるnegative controlも確認しました。相手はloopback上の模擬registryとOIDC endpointのみです。

加えて、公式Linux x64バイナリを、Docker DesktopのLinux/amd64コンテナ（macOS arm64ホスト上）で実行しました。コンテナ自体を`--network none`にし、その中でさらに新しいnetwork namespaceを作ってloopbackだけを有効にしています。root filesystemとバイナリ・probeのmountはread-only、HOMEは一時領域で、外部接続のnegative controlも確認しました。**以下の7ケースは両環境で同じ結果**です。これはローカルコンテナの観測であり、本番CI runnerそのものの実行証拠ではありません。

- 固定tgz：stage POST 1回。元bytes・SHA512・tag `next`・access `public`・交換後の模擬token・stage IDを確認。
- `--reporter=silent`を加えた固定tgz：同じ送信条件を確認し、標準出力がJSONだけになることを確認。通常の`--json`だけでは進捗ログも標準出力に混ざります。
- OIDC応答のtoken欠落：exit 1。ただし警告後に**認証なしのstage POSTを1回試行**し、模擬registryが401で拒否。
- provenance用token不正：署名処理の入口でexit 1、stage POST 0回。署名の成功経路は未実行。
- stageが500：exit 1、stage POSTは1回。自動再送は観測されず。
- dry-run：exit 0、stage POST 0回。
- OIDC応答が壊れたJSON：exit 1。ただし認証なしのstage POSTを1回試行し、模擬registryが拒否。

全ケースでlifecycle実行と通常publishのPUTは観測されませんでした。送信条件の検証ではprovenanceを明示的に無効にし、署名失敗ケースだけ有効にしています。7ケースが実行できたことを、本物のprovenance成功や採用承認とは扱いません。

pnpm単体にはOIDC失敗時のfallbackがあります。移行する場合も現在の**mandatory OIDC preflight**とcredential隔離を維持し、CLIを起動する前に止める必要があります。自動判定への依存を避けるため、公開時の`--provenance`も必須のままです。

## 再現用ファイルと残る確認

- [`assess-pnpm12.py`](../scripts/release/assess-pnpm12.py)：完全なソースtreeとCargo.lockを照合し、対象グラフのOSV照会・advisory hash・経路を保存します。指摘がある場合の終了コードは**2**です。Cargo/Rustの取得先は呼び出し側で用意します。
- [`probe-pnpm12.py`](../scripts/release/probe-pnpm12.py)：ハッシュ固定した公式native binaryだけを模擬registryに接続します。macOSはsandbox、Linuxは呼び出し側が用意した新しいnetwork namespaceを要求します。
- [`pnpm12-candidate-assessment.json`](../scripts/release/pnpm12-candidate-assessment.json)：今回の版・配布物・対象監査・protocol結果の記録です。公開policyではなく、upload runnerからは参照されません。

```sh
# pnpm-sourceには、上記commitの完全なclean sourceを用意する。
# HOME/CARGO_HOMEを一時領域にし、Cargo 1.97.0と利用可能なrustcを指定する。
python3 scripts/release/assess-pnpm12.py /absolute/pnpm-source /absolute/audit-report

# 公式archiveをintegrity照合して展開したバイナリを指定する。
python3 scripts/release/probe-pnpm12.py /absolute/pnpm /absolute/protocol-report
```

Linuxでは`unshare --net python3 ...`のように新しいnamespaceから後者を実行します。probe自身がloopbackを有効にします。Dockerの場合は`--init`を使用し、PID 1を元のnamespaceに残します。コンテナは`--network none`、namespace作成とloopback設定に必要な権限を与え、バイナリ・probeはread-only mountにします。今回の試験image IDは`sha256:2eeeb02f6fa938fea744f119b99dc27b45db69f06d80f9c523e8d828328cfa90`、baseは`python:3.14-slim-bookworm@sha256:945c2676dc2b18e0c1f16879244122c57c0ffede60006bf3df159c507a31bcae`で、`iproute2`と`util-linux`を追加しました。コンテナは終了後に削除しています。

採用までに残るのは、未受入指摘の到達性・処理条件の判断、成功する署名経路とnpmが受け入れるprovenance形式の確認、既存runnerへの接続時の必須preflight・受領結果・送信後エラー処理の検証と、その最終構成によるLinux CIでの再確認です。protected environment・ownerの最終承認も維持します。今回、公開policy・CI・lockfileの移行や実registryへのstage/publishは行っていません。
