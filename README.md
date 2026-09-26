# bizzet

bizzet is a wallet built for business operations, from receiving sales to managing team funds.

## Description

bizzet is a wallet designed around the actual operations of a real business. Sales go straight into each store's own wallet without a payment processor or settlement wait in between, and then flow up from each store to the headquarters wallet, including payments made on other chains, which are automatically bridged, converted to the currency the business chose, and gathered into a single ledger at headquarters.

On top of the basics of receiving, holding, and sending funds, bizzet adds what a team needs to run a business. Organizations are modeled as groups (headquarters and its stores, including online shops), and each group has its own wallet. Members join a group with a role—Owner, Approver, or Viewer—that decides what they can see and do, and policies such as requiring two approvals for withdrawals from headquarters are enforced on-chain. Members sign in and approve transactions with a passkey on their own device, so no one has to manage private keys or seed phrases, and they never pay gas fees themselves. A dashboard shows balances, withdrawals, members, and funds still in transit between chains, scoped to each member's role and group.

Payment settings such as the receiving currency and wallet address live in one on-chain name per store, so changing them once updates every sales channel.

### 日本語

bizzet は、実際のビジネスの業務に沿った設計がされたウォレットです。売上は決済代行や入金待ちを挟まずに各店舗のウォレットへ直接入ったあと本部のウォレットに集まり、別のチェーンで払われた分も自動でブリッジされ、ビジネスが選んだ通貨に交換されたうえで、本部の1つの台帳にまとめられます。

受け取り・保管・送金というウォレットの基本に加えて、bizzet はチームでビジネスを回すための機能を備えています。組織は本部とその配下の店舗（EC サイトを含む）というグループで表し、グループごとに自分のウォレットを持ちます。メンバーはグループに所属して Owner・Approver・Viewer のいずれかのロールを持ち、そのロールで見られる範囲とできる操作が決まり、「本部からの出金には2人の承認が要る」といったポリシーはオンチェーンで強制されます。メンバーは自分の端末のパスキーでログインと承認を行うため、秘密鍵やシードフレーズを管理する必要がなく、ガス代を自分で払うこともありません。ダッシュボードでは、残高・出金・メンバー・チェーン間を移動中の売上を、メンバーのロールと所属グループに合わせて確認できます。

受け取る通貨や受取先のアドレスといった決済の設定は店舗ごとのオンチェーンの名前1つに置くため、そこを1回書き換えるだけですべての販売チャネルに反映されます。

## How it's made

The repo is a pnpm monorepo (`apps/wallet`, `apps/dashboard`, `packages/contracts`, `packages/db`) managed with Biome and Lefthook. Both apps are SvelteKit + Svelte 5 + Tailwind v4, and the dashboard's login/session runs on better-auth backed by Drizzle ORM over Neon serverless Postgres.

Each group's wallet is a Gnosis Safe, and `packages/contracts` (viem/ox + Hardhat) contains the raw calldata builders instead of relying on the Safe SDK, since we needed control that the SDK doesn't expose: `encodeSafeInitializer` bundles enabling the Safe4337Module (EntryPoint v0.7, for ERC-4337 gasless transactions) and creating each member's passkey signer into one MultiSend inside the Safe's own `setup()` call, so a group launches pre-configured — module enabled, owners set, passkey signers deployed — in a single transaction. We also hand-wrote the EIP-712 `SafeOp` typed-data struct for Safe4337Module v0.3, since no SDK covers it, and `predictSafeAddress` reproduces the factory's CREATE2 computation so the wallet can show a group's address before it's ever deployed.

Members never hold a private key: passkeys (P-256, via SafeWebAuthnSignerFactory) become Safe owners directly, so a device's biometric signature is what satisfies the Safe's approval threshold, and an ERC-4337 Paymaster covers gas so members never touch it. For payouts, an on-chain name (ENSv2 subname per store) holds the receiving currency and address as text records, so every sales channel reads the same source of truth. Cross-chain sales are swept home by an external keeper (Gelato/Chainlink Automation) whose on-chain permission is scoped to a single destination — the home Safe — using Circle's CCTP v2 for the actual USDC transfer and Uniswap for any JPYC conversion, so the automation can move funds without ever being able to steal them.

### 日本語

リポジトリは pnpm のモノレポ（`apps/wallet`、`apps/dashboard`、`packages/contracts`、`packages/db`）で、Biome と Lefthook で管理しています。両アプリとも SvelteKit + Svelte 5 + Tailwind v4 で作り、ダッシュボードのログインとセッションは better-auth を Drizzle ORM 経由で Neon の Serverless Postgres に接続して実現しています。

各グループのウォレットは Gnosis Safe で、`packages/contracts`（viem/ox + Hardhat）は Safe SDK を使わず生の calldata を組み立てています。SDK では出せない制御が必要だったためです。`encodeSafeInitializer` は、Safe4337Module（EntryPoint v0.7 による ERC-4337 のガスレス取引）の有効化と、メンバーごとのパスキー署名者の作成を1つの MultiSend にまとめ、Safe 自身の `setup()` 呼び出しに載せています。これにより、モジュールの有効化・オーナーの設定・パスキー署名者の配置まで済んだ状態で、グループのウォレットを1トランザクションで立ち上げられます。Safe4337Module v0.3 の EIP-712 の `SafeOp` 型もどの SDK にもないため自前で書き、`predictSafeAddress` はファクトリの CREATE2 の計算をそのまま再現することで、配置前のグループのアドレスを画面に出せるようにしています。

メンバーは秘密鍵を一切持ちません。パスキー（P-256、SafeWebAuthnSignerFactory 経由）がそのまま Safe のオーナーになるため、端末の生体認証の署名がそのまま Safe の承認条件を満たし、ガス代は ERC-4337 の Paymaster が肩代わりするためメンバーが触ることもありません。受け取りの設定は、店舗ごとの ENSv2 のサブネームがテキストレコードとして受取通貨とアドレスを持つ形にし、すべての販売チャネルが同じ1箇所を読みにいくようにしています。チェーンをまたいだ売上は、外部のキーパー（Gelato や Chainlink Automation）が集めますが、そのオンチェーンの権限は「宛先はホームの Safe だけ」に絞り、実際の USDC の移動には Circle の CCTP v2、JPYC への交換には Uniswap を使うことで、automation 自体が資金を盗める余地をなくしています。
