<p align="center"><img src="brand/bizzet-logo-horizontal.png" alt="bizzet" width="360"></p>

# bizzet

English: [README.md](README.md)

bizzet は、売上の受け取りからチームの資金管理まで、ビジネスの業務のために作るウォレットで、パスキーでのログインと複数メンバーによる承認を Safe の上で実現します。

## 課題とプロダクトの構想

暗号資産での決済を受けるビジネスは、それをチームで回す必要があります。売上は複数の店舗に入り、資金は本部に集める必要があり、出金には1人ではなく複数人の承認が欲しい一方、一般的なウォレットはシードフレーズを持つ1人を前提にしており、ビジネスの運用に合いません。

bizzet の構想では、組織を本部とその配下の店舗（EC サイトを含む）というグループで表し、グループごとに Safe を持ちます。メンバーは Owner・Approver・Viewer のいずれかのロールで所属し、そのロールで見られる範囲とできる操作が決まり、「本部からの出金には2人の承認が要る」といったルールは Safe のしきい値としてオンチェーンで強制されます。メンバーは自分の端末のパスキーでログインと承認を行うため、秘密鍵を管理する必要もガス代を払う必要もありません。店舗の売上は本部の Safe にしか送れないキーパーが集め、ダッシュボードで残高・出金・メンバーを確認できます。

## ETHGlobal Tokyo 2026 の期間中に作ったもの

ここにあるものはすべて Ethereum Sepolia のみで動きます。

### packages/contracts

| 作ったもの | 確認方法 |
| --- | --- |
| Safe v1.4.1、Safe4337Module v0.3.0、EntryPoint v0.7、パスキー署名者 v0.2.1、Zodiac Roles v2.1.1、JPYC、USDC の Sepolia アドレスの確認 | フォークテストでコントラクトの存在を確認 |
| グループ用 Safe の `setup()` の calldata（モジュールなし、CompatibilityFallbackHandler） | フォークテストで、予測したアドレスと SafeTx ハッシュが配置済みの Safe と一致 |
| relayer / 4337 用 Safe の `setup()` の calldata（Safe4337Module と、同じ `setup()` 内で MultiSend により作るパスキー署名者） | フォークテストでの UserOperation のエンドツーエンド実行と、後述の実際の Sepolia の tx |
| `predictSafeAddress`（CREATE2） | フォークテストで、アドレスが配置済みの Safe と一致 |
| Safe4337 の SafeOp と Safe v1.4.1 の SafeTx の EIP-712 ハッシュ | 配置済みのコントラクトに対するフォークテスト |
| パスキー（WebAuthn）署名のエンコードと viem のスマートアカウント `toSafePasskeyAccount` | フォークテストで、パスキー署名の UserOperation を EntryPoint の `handleOps` で実行 |
| ERC-20 送金とオーナー変更のエンコーダ | ダッシュボードの提案で使用、オンチェーンでは未実行 |
| 店舗の Safe の入れ子の承認（`hashNestedSafeTransaction`、`encodeNestedSafeSignature`）：本部のオーナーが、店舗の SafeTx の EIP-712 の元のバイト列（`0x1901 ‖ domainSeparator ‖ structHash`）を中身とする本部の Safe の SafeMessage に署名し、本部の Safe のコントラクト署名（入れ子の ERC-1271）として包む | フォークテスト（`test/store-safe-approval.ts`）で、本部のオーナー2人の署名で店舗の `execTransaction` を実行、署名1つや誤ったメッセージへの署名では拒否 |
| Zodiac Roles v2 の設定エンコード（ModuleProxyFactory での配置、キーパーを HQ Safe への JPYC/USDC `transfer` だけに絞る、モジュールの有効化）を1回の MultiSendCallOnly の delegatecall で実行 | フォークテストで、キーパーは HQ Safe にだけ送金でき、他の宛先や関数は拒否 |
| `execTransaction` のエンコードと、署名者ファクトリの `isValidSignatureForSigner` によるパスキー署名の検証 | フォークテストで、2人のパスキーのオーナーの署名により1つの UserOperation で HQ Safe の配置と出金を実行、署名1つでは拒否 |
| Sepolia の ENSv2：本部の `.eth` の登録（MockUSDC での commit/register）、VerifiableFactory によるサブネームのレジストリと PermissionedResolver の配置、店舗のサブネーム、`addr`・`bizzet.currency`・`description` のレコードを1回の multicall で書き込み、UniversalResolverV2 による `resolveGroupName` | フォークテストで、登録、冪等な再実行、レコードの書き込み、Universal Resolver での解決 |
| 一度きりの ENS のセットアップを行い `ens_settings` の行を出力する `ens:setup` スクリプト | フォークテストと同じコードパス、実際の Sepolia では未実行 |
| Sepolia の Uniswap v4（`src/uniswap.ts`）：V4Quoter での受取量固定の見積もり、Universal Router の `V4_SWAP`（SWAP_EXACT_OUT_SINGLE + SETTLE_ALL + 店舗の Safe への TAKE）、Permit2 の承認、PositionManager による全範囲の流動性 | フォークテスト（`test/uniswap.ts`）で、流動性の追加と JPYC→USDC・USDC→JPYC の受取量固定の交換、受取人がちょうどその量を受け取り見積もりが支払額と一致 |
| Sepolia のプールに JPYC/USDC の全範囲の流動性を足す `uniswap:liquidity` スクリプト | フォークテストと同じコードパス、実際の Sepolia では未実行 |

Sepolia フォークテスト 23 件は、コントラクトの存在、Safe の作成、パスキー署名の UserOperation を EntryPoint の `handleOps` でエンドツーエンドに実行して Safe とその署名者を配置すること、グループ用 Safe のアドレスと SafeTx ハッシュが配置済みの Safe と一致すること、キーパーが HQ Safe にしか送金できないこと、2人のパスキーによる本部の出金の承認と実行、本部のオーナーによる店舗の Safe の取引の入れ子の承認と実行、ENSv2 の登録・レコード・解決、Uniswap v4 の流動性と両方向の受取量固定の交換を確認します。

**実際の Sepolia での実行。** テスト用の P-256 鍵で署名した UserOperation を、ウォレットのサーバープロキシ経由で Pimlico の bundler と paymaster に送り、ガス代をスポンサーしてもらった状態で Safe とそのパスキー署名者を配置しました：[0xe1bfcc21…a6c4](https://sepolia.etherscan.io/tx/0xe1bfcc2134d73fb42c8c8b7e26c7581baeec14ad02d4f0764e610008ab5ca6c4)。

### apps/wallet

| 作ったもの | 確認方法 |
| --- | --- |
| サーバーで検証するパスキーのログイン：`/api/session/challenge` が使い捨てのチャレンジ（5分、署名付きの httpOnly cookie）を発行し、`/api/session` が保存済みの公開鍵で WebAuthn のアサーション（チャレンジ、origin、rpId のハッシュ、ユーザー検証）を検証して、HMAC で署名した12時間有効な httpOnly のセッション cookie を設定 | cookie の署名とアサーションの検証の vitest、ブラウザでの手動確認 |
| セッションによるアクセス制御：ウォレットの API はセッションからメンバーを特定し、`/login`・`/pay/**`・`/invite/**` 以外のページは `/login` へリダイレクト | 手動確認 |
| ファクトリの `getSigner` による署名者アドレスの算出 | 手動確認、フォークテストと同じロジック |
| ブラウザから送られた公開鍵でパスキーを DB に登録する招待ページ（メンバー招待とパスキー追加のリンク） | ダッシュボードで発行したリンクでの手動確認 |
| Pimlico の API キーをサーバー側に置き、許可したメソッドだけを転送するサーバープロキシ `/api/bundler` | 手動確認、前述の実際の Sepolia の tx |
| ホーム：所属グループの残高（1回の multicall）と承認待ちの件数 | 使い捨ての DB と開発サーバーに対する API 確認 |
| 承認画面：本部の Owner・Approver がパスキーで、本部の Safe の提案と、入れ子の承認による店舗の Safe の提案に署名し、サーバーが safeTxHash を再計算して署名者がオーナーであることを確かめ、チェーン上で署名を検証してから保存 | API 確認（誤ったハッシュ・誤った鍵・重複した署名を拒否）、署名形式はフォークテスト |
| 実行：しきい値に達すると、最後の署名者が自分のパスキーのアカウント（初回の実行時に自動で作成）と Pimlico で `execTransaction` を送り、未配置のグループの Safe では実行を拒否し、`ExecutionSuccess` のログを確認してから提案を実行済みにする | フォークテスト、実際の Sepolia では未送信 |
| 客向けの決済ページ `/pay/<ens-name>`：店舗の ENS の名前から Safe のアドレスと受取通貨を解決し、円と JPYC/USDC で価格を表示して客のブラウザウォレットで支払い（ERC-20 の `transfer`、または客が別の通貨で払う場合は店舗の Safe に直接届く Uniswap v4 の交換）、処理中から済へ表示が変わる | 価格の解析と換算の vitest、画面の表示確認、実物のウォレットでは未支払い |
| 値札ページ `/pay`：決済の URL と印刷用の QR コードを作成 | 画面の表示確認 |
| 返金依頼 `/business/refund`：店舗のメンバーが返金を依頼し、返金と印を付けた店舗の Safe の出金の提案になる | vitest、手動確認 |
| マイページ `/mypage`：ダッシュボード用の1時間有効なパスワード追加リンクの発行とログアウト | vitest、手動確認 |

### apps/dashboard

| 作ったもの | 確認方法 |
| --- | --- |
| Better Auth のメールとパスワードによるログイン、招待制の参加（メンバー招待とパスワード追加のリンク） | 手動確認、`svelte-check` |
| メンバー：一覧（shadcn の data-table）、名前と肩書き付きの招待、編集、削除 | 手動確認 |
| HQ Safe のオーナーの構成が変わる場合に `owner_change` の提案を作成、ガード付き（3人以上のオーナー、最後の Owner、自分自身） | 手動確認 |
| ウォレット用の1時間有効なパスキー追加リンクを発行するアカウントページ | 手動確認 |
| グループ：一覧、店舗の作成、3人以上のパスキーのオーナーからの HQ Safe の作成（しきい値 2）、店舗 Safe の作成、Roles v2 設定の提案 | 手動確認、エンコーダはフォークテスト |
| Safe の配置：グループ設定の「Safe を配置」が、保存済みの設定でオペレーターの鍵から `createProxyWithNonce` を送信、グループの Safe はここでだけ配置 | 手動確認、実際の Sepolia では未実行 |
| 出金：Safe トランザクションの提案の一覧・詳細・作成（空いた nonce を再利用する nonce の割り当て）、却下、送信済みの提案の実行済みへの同期 | 手動確認 |
| ホーム：1回の multicall による残高 | Sepolia での手動確認 |
| 入金インデクサ：時間の上限付きの ERC-20 Transfer の差分取り込みと、Bearer トークンで保護した `/api/cron/deposits` | 手動確認 |
| 空状態のブリッジ画面（ベータにはブリッジなし） | 手動確認 |
| Paraglide による日本語と英語（cookie、次にブラウザの言語、最後に ja の順）と shadcn のサイドバー | 手動確認 |
| ENS：店舗の作成時に `<label>.<hq>.eth` を登録してレコードを書き込むラベル欄、グループ設定での再試行と通貨の編集、グループの画面での解決したアドレスと通貨の表示（ENS と DB が食い違えば警告） | `svelte-check`、登録のコードは ENS のフォークテスト |

vitest は補助関数のロジックだけを対象にしており、ダッシュボードの 11 件はロールのルール・メンバー変更の補助関数・グループの並び順を、ウォレットの 65 件はパスキーの公開鍵の解析・セッション cookie の署名・WebAuthn のアサーションの検証・値札の URL の解析と換算・交換のスリッページと承認手順の計画・メンバーが署名できる提案の判定・返金・パスワード追加リンクを確認します。両アプリの型チェックも通ります。

### packages/db

Drizzle のスキーマとマイグレーションで、docker compose のローカル Postgres とローカルの Neon HTTP プロキシを使います。ローカルで `pnpm db:migrate` と `pnpm db:seed` を実行して確認しました。

### docs

Docusaurus による日本語のホワイトペーパーと設計書（18 ページ）で、未決事項はありません。まだ作っていない部分も含め、設計の全体を記述しています。

## 作ったが実際の Sepolia ではまだ実行していないもの

- **ENS のセットアップ**：`ens:setup` のスクリプトと店舗のサブネームの登録は Sepolia のフォークでだけ確かめており、実際の Sepolia では本部の名前をまだ登録していません。登録するまで `/pay/<名前>` は受取先がない旨を表示します。
- **出金の実行と客の支払い**：本部の Safe と入れ子の店舗の Safe の実行はフォークテストと画面の表示で確かめましたが、実物のパスキーと客のウォレットではまだ試していません。
- **ダッシュボードからの Safe の配置**：実際の Sepolia ではまだ送信していません。
- **パスキーのログイン**：サーバーでの検証は vitest で確かめましたが、配置したウォレットに実物のパスキーでログインすることはまだ試していません。

## 未実装のもの（docs で設計済み、実装予定）

以下は `docs/` で設計済みですが、このリポジトリにはまだ実装していません。

- **Checkout コントラクト**：支払いを受けて `Paid` イベントを出すコントラクトと、電子ペーパーの値札。いまは、交換が要るときに客のウォレットが Uniswap の Universal Router を直接呼びます。
- **レシート**：Semaphore v4 による購入証明。
- **中継用の Safe**：実行は、bizzet の中継用の Safe ではなく、最後に署名したメンバー自身のパスキーのアカウントから送っています。
- **登録時のパスキーの attestation の検証**：サーバーはブラウザから送られた公開鍵をそのまま保存しています。
- **運用**：自動ブリッジと CCTP、Gelato キーパーの配置とオンチェーンでの集金実行、セットアップ後に HQ メンバーがパスキーを登録したときのオーナー追加提案の自動作成。

## Uniswap v4 との連携

客は、店舗の受取通貨にかかわらず JPYC か USDC で払えます。通貨が違うときは、決済ページが V4Quoter で受け取る量を固定した見積もりを出し、客のウォレットが Universal Router の `V4_SWAP` を1回送ります。客からは Permit2 経由で払い、交換した通貨は `TAKE` で店舗の Safe に直接届くため、店舗は自分の通貨でちょうど価格の分を受け取ります。

| コード | 役割 |
| --- | --- |
| `packages/contracts/src/uniswap.ts` | アドレス、プールキー、見積もり、交換と Permit2 のエンコード、全範囲の流動性 |
| `packages/contracts/test/uniswap.ts` | 流動性と両方向の交換の Sepolia フォークテスト |
| `packages/contracts/scripts/uniswap-liquidity.ts` | Sepolia の JPYC/USDC プールへの全範囲の流動性の追加 |
| `apps/wallet/src/lib/swap.ts` | 決済ページでのスリッページ、期限、承認手順の計画 |
| `apps/wallet/src/routes/pay/[name]/+page.svelte` | 交換を提示する決済ページ |
| `FEEDBACK.md` | Uniswap v4 で開発したことへのフィードバック |

Sepolia の JPYC/USDC プール（手数料 0.01%、tick spacing 1、フックなし）は 1 USDC あたり約 150 JPYC で初期化されていましたが、価格帯内の流動性がなかったため、実際の Sepolia で交換できるのは `uniswap:liquidity` を実行した後です。

```sh
LIQUIDITY_PRIVATE_KEY=0x... SEPOLIA_RPC_URL=https://... LIQUIDITY_USDC=20 LIQUIDITY_JPYC=3000 \
  pnpm --filter @bizzet/contracts uniswap:liquidity
```

## アーキテクチャ

ベータは Ethereum Sepolia のみで動きます。

| コンポーネント | 設計 | 状況 |
| --- | --- | --- |
| HQ Safe | 3人以上のパスキーのオーナーとしきい値 2 の Safe v1.4.1 | 作成は実装済みでフォークテスト済み、ダッシュボードから配置 |
| 店舗 Safe | HQ Safe を唯一のオーナーとする Safe | 作成は実装済み、ダッシュボードから配置 |
| メンバーの承認 | メンバーがパスキーで Safe トランザクション（EIP-712 の SafeTx）に署名 | 本部の Safe の提案と店舗の Safe の提案（入れ子の ERC-1271）は実装済みでフォークテスト済み |
| relayer | Safe4337Module を持つ bizzet の relayer Safe が、署名済みのトランザクションを ERC-4337 で送信 | 暫定で最後の署名者のパスキーのアカウントが `execTransaction` を送信（フォークテスト済み）、relayer Safe は未実装 |
| ガス代のスポンサー | Pimlico の paymaster | 実装済み（ウォレットのサーバープロキシ） |
| Safe の配置 | ダッシュボードからオペレーターの鍵がグループの Safe の `createProxyWithNonce` を送信 | 実装済み、実際の Sepolia では未実行 |
| キーパーの権限 | Zodiac Roles v2 でキーパーを HQ Safe への JPYC/USDC の送金だけに限定 | エンコードは実装済みでフォークテスト済み、キーパーは未配置 |
| 提案 | 出金・オーナー変更・Safe 作成の提案を Postgres に保存 | 実装済み（作成、却下、同期） |
| 受け取りの設定 | グループごとの ENSv2 の名前が、Safe を `addr` のレコード、受取通貨を `bizzet.currency` のテキストレコードとして保持 | 実装済みでフォークテスト済み、実際の Sepolia でのセットアップは未実行 |

グループの Safe はモジュールを持たないため、資金を動かす手段は、オーナーのしきい値を満たす SafeTx と、範囲を狭く絞ったキーパーの Roles の権限だけです。Pimlico の paymaster のスポンサーは発行から10分で切れ、複数メンバーの署名を集めるには短すぎるため、メンバーは UserOperation ではなく SafeTx に署名し、relayer が送信時に署名のそろった SafeTx を自分の UserOperation に包みます。

Safe の calldata は Safe SDK を使わず `packages/contracts`（viem/ox）で自前で組み立てています。`setup()` の中でパスキー署名者を作ることと、Safe4337Module v0.3 の SafeOp をハッシュすることが必要でしたが、SDK はどちらにも対応していないためです。

## リポジトリの構成

| パス | 内容 |
| --- | --- |
| `apps/wallet` | メンバー向けウォレット（SvelteKit、Svelte 5、Tailwind v4、パスキー） |
| `apps/dashboard` | 管理用ダッシュボード（SvelteKit、Better Auth、Paraglide による ja/en、shadcn-svelte） |
| `packages/contracts` | Safe / ERC-4337 / Roles の calldata の組み立て（viem/ox）と Hardhat 3 のフォークテスト |
| `packages/db` | Drizzle のスキーマとマイグレーション、Neon serverless ドライバ |
| `docs` | Docusaurus によるホワイトペーパーと設計書（日本語） |

リポジトリは pnpm のモノレポで、Biome と Lefthook で管理しています。

## ローカルでの実行

Node.js 20 以上、pnpm 10、Docker が必要です。

```sh
pnpm install
pnpm db:up       # Docker の Postgres とローカルの Neon HTTP プロキシ
pnpm db:migrate
pnpm db:seed     # Owner を作成: admin@example.com / password（ローカル専用）
pnpm dev         # docs :3000、dashboard :5174、wallet :5175
```

初期データの認証情報はローカルでの開発専用です。

### 環境変数

`apps/wallet/.env`

| 変数 | 用途 |
| --- | --- |
| `PIMLICO_API_KEY` | Pimlico の bundler/paymaster のキー、サーバー側でのみ使用 |
| `PUBLIC_PASSKEY_RP_ID` | 任意、WebAuthn の rpId の上書き |
| `DATABASE_URL` | ダッシュボードと共有する Postgres の URL |
| `PUBLIC_SEPOLIA_RPC_URL` | 任意、Sepolia の RPC エンドポイント（既定は CORS 対応の `https://ethereum-sepolia-rpc.publicnode.com`） |
| `WALLET_SESSION_SECRET` | セッション cookie に署名する鍵、本番では必須で開発時はプロセスごとの使い捨ての鍵を使用 |
| `PUBLIC_DASHBOARD_URL` | パスワード追加リンクで使うダッシュボードの URL（既定は `http://localhost:5174`） |
| `PUBLIC_PAY_MOCK_RESOLUTION` | 開発サーバー専用、`0xaddress,USDC,name` で決済ページの ENS の解決を置き換え、その旨を画面に表示 |

`apps/dashboard/.env`

| 変数 | 用途 |
| --- | --- |
| `DATABASE_URL` | Postgres の URL、空ならローカルの DB を使用 |
| `BETTER_AUTH_SECRET` | Better Auth のシークレット |
| `BETTER_AUTH_URL` | ダッシュボードのベース URL |
| `SEPOLIA_RPC_URL` | 任意、Sepolia の RPC エンドポイント（既定はウォレットと同じ） |
| `KEEPER_ADDRESS` | Roles v2 の設定で権限を絞るキーパーのアドレス |
| `CRON_SECRET` | `/api/cron/deposits` 用の Bearer トークン |
| `DEPOSITS_START_BLOCK` | 任意、入金インデクサの開始ブロック |
| `PUBLIC_WALLET_URL` | 招待リンクとパスキー追加リンクで使うウォレットの URL |
| `ENS_OPERATOR_PRIVATE_KEY` | 店舗のサブネームの登録、ENS のレコードの書き込み、グループの Safe の配置を行うオペレーターの鍵（ガス代用の Sepolia ETH だけを保有） |

### ENS のセットアップ（1回のみ）

```sh
ENS_OPERATOR_PRIVATE_KEY=0x... SEPOLIA_RPC_URL=https://... ENS_HQ_LABEL=bizzet \
  ENS_HQ_SAFE_ADDRESS=0x... pnpm --filter @bizzet/contracts ens:setup
```

このスクリプトは `<label>.eth` を登録し、サブネームのレジストリとリゾルバを配置して本部のレコードを書き込んだうえで、`ens_settings` の行を作る SQL を出力します。その SQL をダッシュボードのデータベースに対して実行してください。

## テスト

```sh
# Sepolia フォークテスト（23 件）
cd packages/contracts && SEPOLIA_RPC_URL=https://sepolia.gateway.tenderly.co pnpm test

# リポジトリのルートから vitest（dashboard 11 件、wallet 65 件）
pnpm test

# ダッシュボードの型チェック
pnpm --filter @bizzet/dashboard run check
```

## AI の利用

ETHGlobal はチームに、AI ツールを使った箇所の記載を求めています。私たちは AI を多用しました。

| ツール | 使った箇所 |
| --- | --- |
| Claude Code（Anthropic。Claude Opus 5.5、Claude Sonnet 5、Claude Fable 5.1） | プロトコルの調査（Safe、ERC-4337、Pimlico、Zodiac Roles、Semaphore、ENSv2、CCTP） |
| Claude Code | チームの方針をもとにした日本語の設計書の下書き |
| Claude Code | `packages/contracts`・`packages/db`・`apps/wallet`・`apps/dashboard` のコードの大半の実装（ダッシュボードの機能は並列のサブエージェントで実装） |
| Claude Code | テストの作成と変更のレビュー |
| Devin（Cognition） | `devin-ai-integration[bot]` による 10 コミット、PR #1〜#11 としてマージ |

Claude Code と共同で作ったコミットには `Co-Authored-By: Claude …` のトレーラーが付いています（執筆時点で 64 コミット）。Devin の PR は、ダッシュボードの shadcn のセットアップ、DB 接続、ログインページ、docs のデプロイの修正、招待からの登録、パスキーの rpId、Better Auth のログイン、docs の追記、vitest 付きの zod + superforms による入力検証を扱いました。

人間のチームメンバーは、プロダクトの方針と要件を決め、すべての設計判断を行い、変更をレビューして承認し、手動での確認を行いました。

**仕様ファイル。** 仕様駆動で開発しました。AI が参照した仕様はリポジトリにあり、`docs/docs/*.mdx`（機能一覧、画面、ウォレットの設計ほかの設計書）と `CLAUDE.md`（ドキュメントを書くときのルール）です。

**プロンプト。** チャットのプロンプトはこのリポジトリには含めていません。ETHGlobal の審査員の求めに応じて提出できます。

> TODO（チーム）：提出前にプロンプトを書き出し、上の行を公開先の記載に置き換える。

## ハッカソンの経過

| 日時（JST） | 内容 |
| --- | --- |
| 2026-09-25 20:57 | 最初のコミット（1行の README） |
| 2026-09-25 21:29 | Docusaurus のテンプレートとダッシュボードのアプリを入れた pnpm ワークスペース |
| 2026-09-26 – 09-27 | ホワイトペーパーと設計書、コントラクト、DB、ウォレット、ダッシュボード（合計 44 以上のコミット） |

出発点にした公開ボイラープレートは Docusaurus、SvelteKit、shadcn-svelte、Hardhat 3 のテンプレートで、それ以外はすべて期間中に書きました。
