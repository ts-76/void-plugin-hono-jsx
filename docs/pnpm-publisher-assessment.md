# pnpm 公開 job の依存評価と採用条件

2026-10-11、**pnpm 12.11.2 の Linux x64 native binary を、固定 tarball の stage 公開に限定して採用しました。** 2026-10-17に公開CLIを **12.14.0** へ更新しました。監査対象は517 crateです。既存4件の条件を維持し、同日の保守者承認により `zip 8.6.0` の3件を同じ固定tgzのstage範囲だけで追加しました。現在の限定受け入れは計7件です。監査0件や、あらゆるpnpmコマンドの安全性を示す判断ではありません。

12.11.2の `rustls 0.23.45` は、10月14日公開の [RUSTSEC-2026-0346](https://rustsec.org/advisories/RUSTSEC-2026-0346.html) により必須CIで停止しました。12.14.0は修正版の `rustls 0.23.46` を含みます。このrustls更新では新しい監査例外を追加していません。後述のzip 3件は、その後の個別承認による追加です。配布物のintegrity・binary SHA256、ソースarchive・Cargo.lock・Linux inventoryのhashを更新し、CIは保存したinventoryとの完全一致と実バイナリの隔離protocol検証を引き続き要求します。

現在の参照ソースは [pnpm 12.14.0](https://github.com/pnpm/pnpm/tree/fe4a0c232384289de82be3d502896ca7e070050c)、commit `fe4a0c232384289de82be3d502896ca7e070050c` です。以下の12.11.2の記録は初回の到達経路評価です。更新時はstage/provenance経路の差分と新しいLinux Cargo解決を再確認し、現在承認した7件以外が現れた場合や、既存指摘の内容・版・更新時刻が変わった場合は停止します。

対象は、このリポジトリの固定tgzを送信するLinux x64 stage jobだけです。RC.1のOIDC/provenance付きstageとowner Approve後の公開物検証は完了しており、[リリース記録](releasing.md#rc1-publication-and-workers-evidence)にまとめています。開発・ビルド・候補作成・lockfileはnpmを使います。正式版候補も毎回fresh auditを行い、準備中は `NPM_STAGING_ENABLED=false` を維持します。下記の初回alphaや旧CLIの記録を、別のコマンド・版・targetの承認として使いません。

## 2026-10-17: ZIP展開に関する3件の限定受け入れ

PR #75の必須publisher CIは、新たに検出した `zip 8.6.0` の指摘で停止しました。同日時点のnpm公式 `latest-12` は12.14.0で、zip修正版を含むpnpm 12の公開版は確認できませんでした。保守者は到達経路評価を確認し、以下3件を既存のLinux x64・固定tgzのstage処理に限って受け入れることを明示的に承認しました。

| 指摘 | 対象APIと影響 |
| --- | --- |
| [RUSTSEC-2026-0367 / GHSA-vv5m-jxxh-4627](https://github.com/zip-rs/zip2/security/advisories/GHSA-vv5m-jxxh-4627) | `ZipArchive::extract()` / stream extractionでSUID・SGID等の権限bitを保持する。特権プロセスが不正なZIPを展開すると権限昇格につながり得る |
| [RUSTSEC-2026-0368 / GHSA-4v9h-p7m9-rh26](https://github.com/zip-rs/zip2/security/advisories/GHSA-4v9h-p7m9-rh26) | `ZipArchive::extract()`が展開先の外を指すsymlinkを作成し、その後の読み書きが外部パスへ到達し得る |
| [RUSTSEC-2026-0369 / GHSA-4684-h2q9-2vcp](https://github.com/zip-rs/zip2/security/advisories/GHSA-4684-h2q9-2vcp) | ZIP展開中にsymlink経由で外部対象へUnix権限を適用し得る |

3件の上流修正版はzip 9.0.0です。pnpmの推移依存override、独自バイナリの再ビルド、包括的な監査除外は行いません。

固定source archiveのhash一致を確認し、次の呼び出しを追跡しました。

1. [`stage_publish`](https://github.com/pnpm/pnpm/blob/fe4a0c232384289de82be3d502896ca7e070050c/pnpm/crates/cli/src/cli_args/stage.rs)は通常の公開処理へ `stage=true` で委譲する。
2. 明示的な `.tgz` は [`publish_tarball`](https://github.com/pnpm/pnpm/blob/fe4a0c232384289de82be3d502896ca7e070050c/pnpm/crates/cli/src/cli_args/publish.rs) を選び、元のbytesを公開処理へ渡す。ディレクトリのpackやinstallは行わない。
3. [`extract_publish_manifest_from_packed`](https://github.com/pnpm/pnpm/blob/fe4a0c232384289de82be3d502896ca7e070050c/pnpm/crates/publish/src/extract_manifest_from_packed.rs)はgzip/tarのentryをメモリ上で読み、対象のZIP展開APIやZIPのfilesystem展開を行わない。provenanceは元tgzのbytesをsubjectにする。

別経路のZIP取込処理も `ZipArchive::by_index` でentryを走査し、権限を `& 0o777` に制限してcontent-addressed storeへ書き込みます。このinstall/runtime download経路は、今回の受け入れ範囲には含めません。

これはソースの到達経路評価であり、全native命令・全エラー分岐の動的な非到達証明ではありません。既存のLinux隔離protocol検証を維持し、CI artifactへZIP関連のsource caller情報も保存します。517 crateの再照会では、既存4件とこの3件だけを検出しました。3件ともcrate/version/ID・modified・advisory全体のSHA256を固定しています。版・source・target・コマンド・指摘内容が変われば再評価し、新しい指摘では停止します。修正版pnpmの公開時もpin更新と再検証が必要です。CIの通過は、本物のOIDC/provenance付きstageの成功を意味しません。

## 実ビルドの監査範囲

対象ソースは [pnpm 12.11.2](https://github.com/pnpm/pnpm/tree/1e37c514f247e89da8725afb8b96969996d9b409)、commit `1e37c514f247e89da8725afb8b96969996d9b409` です。上流 Linux 配布ビルドと同じ `pnpm-cli`、default features、`x86_64-unknown-linux-gnu`、Rust 1.97.0、`--locked` で `cargo tree --edges normal,build` を取得しました。Cargo metadata の registry package と照合して 517 crate の版・有効 feature を保存しました。これは Cargo のビルド依存 inventory で、機械語から抽出した SBOM ではありません。

workspace 全体の Cargo.lock にある 774 entry を、そのまま公開バイナリの脆弱性件数として扱いません。選択された graph に quinn-proto、event-listener、h2 0.3.27、libsql-sqlite3-parser、bincode は含まれません。選択された h2 は修正版 0.4.16、reqwest の HTTP/3 feature は無効です。

| 対象 crate | 指摘と発動条件 | 公開経路での判断 |
| --- | --- | --- |
| rsa 0.9.10 | [RUSTSEC-2023-0071](https://rustsec.org/advisories/RUSTSEC-2023-0071.html)、Medium 5.9。RSA 秘密鍵演算の timing side channel。修正版なし | crypto-shasums-file は Node 配布物の公開鍵検証に使用。固定 tgz の stage は runtime download を行わない。Sigstore は一時 ECDSA P-256 鍵を使い、対象の RSA 秘密鍵演算を行う caller は確認されず |
| anyhow 1.0.102 | [RUSTSEC-2026-0190](https://rustsec.org/advisories/RUSTSEC-2026-0190.html)、unsoundness。context を追加した Error の downcast_mut による不正な可変参照 | pnpm の Rust source と選択 crate の caller を検索し、対象の anyhow::Error::downcast_mut を公開経路に確認せず。他 crate の同名関数は std::any::Any、hyper、miette 等の別実装 |
| xxhash-rust 0.8.15 | [GHSA-6g2r-675j-hx59](https://github.com/advisories/GHSA-6g2r-675j-hx59)、Low 2.3。短すぎる custom secret を渡す xxh3 API | 公開 artifact / provenance subject は SHA512。ssri は通常の Xxh3::new() を使い、custom-secret API の外部 caller は確認されず |
| proc-macro-error2 2.0.1 | [RUSTSEC-2026-0173](https://rustsec.org/advisories/RUSTSEC-2026-0173.html)、unmaintained の情報 | ビルド時 macro。公開時の攻撃条件が報告された指摘とは区別する |

非到達性の評価はソース・feature・コマンド範囲の照合です。Rust バイナリ全体を計測した証明や、すべてのエラー経路の網羅ではありません。install、runtime download、query、server、別の tarball・版・feature・target へ受け入れを拡張しません。上流修正版が出た場合も、pin の変更と再検証が必要です。override やバイナリ改変は行いません。

## 実装した監査・認証ゲート

- publisher-policy.json に source archive、Cargo.lock、inventory、配布 tgz の SHA512、native binary の SHA256 を固定。配布物の 4 regular file のみを認め、npm installer、JS wrapper、lifecycle、暗黙の native download を使わず直接導入します。
- CI は毎回 Cargo resolution をやり直し、保存済み inventory と一致させます。公開 job は固定 inventory の全 517 crate を OSV へ再照会します。承認した7件それぞれの crate/version/ID、modified、advisory 全体の hash を照合し、新規・変更・消失・不完全な応答・監査サービスの失敗で停止します。
- Node の事前処理で GitHub OIDC を取得し、npm の package-scoped token exchange を完了してから CLI を起動します。npm の 201 Created 応答も検証しています。取得失敗や token 欠落は CLI 起動前に停止します。
- CLI に既存 login、長期 token、proxy、NODE_OPTIONS、外部 pnpm config を渡しません。専用 cwd、XDG config/data/cache、PNPM_HOME、state/store、明示的 userconfig を使います。userconfig は mode 0600、直前に取得した OIDC token のみです。CLI 内部の追加 exchange が失敗しても、fallback 可能な credential はこの新しい OIDC token に限られます。
- OIDC 後に受け入れ済み tgz を再読込し、SHA256/SHA512 を照合して同一 bytes を専用 cwd にコピーします。pack/build は実行せず、stage publish --ignore-scripts --provenance --reporter=silent で next/public を指定します。成功・失敗とも一時 credential/state を削除します。
- 従来の commit/tag/main ancestry、clean tree、artifact/evidence/run/attempt、public repository、protected environment/reviewer/no-bypass、owner/version のゲートと、owner による最終 2FA 承認を維持します。

配布 package の provenance statement に同じ source commit と tgz digest が記録されていることも照合しました。ただし、その上流 attestation の証明書・署名の暗号検証まで実施していません。直接取得する native 配布物には JS wrapper が含まれないため、wrapper の npm install-tree audit を Rust 監査の代用にしません。比較した pnpm 11.28.5 の JS bundle に残る High の受け入れも行いません。

## 動作確認と留保

pnpm は [stage publish](https://pnpm.io/cli/stage)、[trusted publishing / provenance](https://pnpm.io/cli/publish) を提供します。macOS の実 CLI による先行 fixture に加え、CI は変更のない Linux native binary を loopback 以外へ接続できない network namespace で実行します。fixture は synthetic tgz と fake token を使用します。

| ケース | 確認内容 |
| --- | --- |
| 通常の mock stage | stage POST 1 回、固定 fixture bytes、next/public、OIDC token、receipt integrity の一致。直接 publish PUT と lifecycle はなし |
| native OIDC token 欠落 | CLI 単体は認証なし POST を 1 回試み、mock の 401 で失敗。この挙動を事前 OIDC gate で防ぐことを別の wrapper テストで確認 |
| 無効な Sigstore token | provenance 指定、sigstore audience を取得、署名に進む前に失敗し stage POST 0 回 |
| stage 500 | POST 1 回で失敗、upload の自動再試行なし |
| dry-run | stage POST 0 回 |

正常な mock stage は no-provenance、署名失敗ケースは provenance を使います。正常な署名付き stage を一度に通した結果ではありません。wrapper テストは token 欠落・不正 authority・受入後の tgz 改変で CLI 起動 0 回、失敗時の credential 削除、監査の変更時停止を確認します。

本物の GitHub OIDC / npm Trusted Publisher、Fulcio certificate、Rekor inclusion、署名 bundle の registry 受理、実 stageId、owner approval/2FA は **未検証** です。公開機能を有効にする際は、実 stage の receipt/provenance と、owner 承認後の registry version、next tag、fresh consumer を確認します。

先行調査の元候補 SHA256 は `9e4ad569c3909be35cecffd844d03659f9f75509965a70e76d5023d7b689bbb5` で変更していません。元候補の sandbox dry-run は認証・署名を証明せず、新しい source commit の受入候補を代替しません。最終 commit の候補は既存 CI preparation で作り直します。

継続検証の inventory、advisory 応答、function hits、native protocol は CI artifact publisher-rust-<commit> に 7 日保存します。先行調査は ignored な artifacts/publisher-security-investigation/pnpm/ に保存しています。raw binary、credential、cache は公開パッケージや artifact に含めません。以前の npm CLI 比較は [publisher-security.md](publisher-security.md) に記録しています。
