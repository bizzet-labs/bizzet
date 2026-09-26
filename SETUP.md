# ローカル環境の構築

bizzet のドキュメント・ダッシュボード・ウォレットをローカルで動かすまでの手順です。チェーンは Ethereum Sepolia だけを使います。本番へのデプロイは扱いません。

## 必要なもの

- Node.js 20 以上
- pnpm 10
- Docker（ローカルの Postgres と Neon のプロキシを動かす）

## 手順

```sh
pnpm install
pnpm db:up        # Postgres（:5432）と Neon の HTTP プロキシ（:4444）を起動する
pnpm db:migrate   # マイグレーションを当てる
pnpm db:seed      # ローカル専用の Owner（admin@example.com / password）を作る
pnpm dev          # docs :3000、ダッシュボード :5174、ウォレット :5175 を起動する
```

`.env` は、`pnpm dev` の前に次の節の内容で作っておきます。スキーマが変わったあとは `pnpm db:migrate` を当て直します。当て忘れると、新しい列を読む画面が 500 エラーになります。

## .env

`.env` はアプリごとに置き、コミットしません。ローカルの DB の接続文字列は `postgres://postgres:postgres@db.localtest.me:5432/bizzet` です（`db.localtest.me` は 127.0.0.1 を指します）。

### apps/dashboard/.env

| 変数 | 必須 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | 任意 | Postgres の接続文字列。空ならローカルの DB |
| `BETTER_AUTH_SECRET` | 必須 | Better Auth のセッションの署名の鍵 |
| `BETTER_AUTH_URL` | 必須 | ダッシュボードの URL（ローカルでは `http://localhost:5174`） |
| `PUBLIC_WALLET_URL` | 任意 | 招待のリンクに使うウォレットの URL（ローカルでは `http://localhost:5175`） |
| `SEPOLIA_RPC_URL` | 任意 | Sepolia の RPC。空なら公開の RPC |
| `KEEPER_ADDRESS` | 任意 | Roles v2 で店舗の Safe からの送金を許すキーパーのアドレス |
| `CRON_SECRET` | 任意 | 入金の取り込みの cron を呼ぶ Bearer トークン。空なら cron は常に拒否 |
| `DEPOSITS_START_BLOCK` | 任意 | 入金の取り込みを始めるブロック |
| `ENS_OPERATOR_PRIVATE_KEY` | 任意 | 店舗のサブネームの登録と ENS のレコードの書き込みに使う運用者の鍵。空なら ENS に書かない |

### apps/wallet/.env

| 変数 | 必須 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | 任意 | ダッシュボードと同じ Postgres。空ならローカルの DB |
| `PIMLICO_API_KEY` | 必須 | Pimlico の bundler と paymaster のキー。サーバー側だけで使う |
| `WALLET_SESSION_SECRET` | 本番で必須 | ログインのセッション Cookie に署名する鍵。dev で空なら起動ごとの使い捨ての鍵 |
| `PUBLIC_SEPOLIA_RPC_URL` | 任意 | Sepolia の RPC。空なら公開の RPC |
| `PUBLIC_PASSKEY_RP_ID` | 任意 | パスキーの rpId。空ならページのホスト名 |
| `PUBLIC_PAY_MOCK_RESOLUTION` | 任意 | dev サーバーでだけ、決済ページの ENS の解決の代わりに使う値（`0xアドレス,USDC,店名`） |

`PIMLICO_API_KEY` がないと、パスキーでの送信（出金の実行と Safe の作成）が 500 エラーになります。

## オンチェーンの準備（任意）

ENS の名前での決済と Uniswap v4 での交換を実際の Sepolia で試すときだけ、1回実行します。どちらのスクリプトも `.env` を読まないため、変数はコマンドの前に付けて渡します。

### ENS の初期セットアップ

運用者の鍵には、ガス代ぶんの Sepolia ETH を入れておきます。登録の予約のあと約65秒待つため、1分ほどかかります。

```sh
ENS_OPERATOR_PRIVATE_KEY=0x... SEPOLIA_RPC_URL=https://... \
  ENS_HQ_LABEL=bizzet ENS_HQ_SAFE_ADDRESS=0x本部のSafe \
  pnpm --filter @bizzet/contracts ens:setup
```

出力の `sql` をダッシュボードの DB で実行すると、ENS の設定が1行入ります。そのあと、ダッシュボードの本部の設定画面で「保存して ENS に書き込む」を押すと、本部の名前が登録済みになります。

### Uniswap v4 の流動性の追加

Sepolia の JPYC/USDC のプールには流動性がないため、交換を試す前に足します。鍵には USDC 20・JPYC 3,000（1 USDC ≒ 150 JPYC の比率）と、ガス代の Sepolia ETH が要ります。

```sh
LIQUIDITY_PRIVATE_KEY=0x... SEPOLIA_RPC_URL=https://... \
  pnpm --filter @bizzet/contracts uniswap:liquidity
```

`LIQUIDITY_PRIVATE_KEY` が空なら `ENS_OPERATOR_PRIVATE_KEY` を使い、量は `LIQUIDITY_USDC` と `LIQUIDITY_JPYC` で変えられます。

## テスト

```sh
pnpm test                                        # 両アプリの vitest
pnpm --filter @bizzet/dashboard run check        # ダッシュボードの型チェック
pnpm --filter @bizzet/wallet run check           # ウォレットの型チェック
cd packages/contracts && SEPOLIA_RPC_URL=https://sepolia.gateway.tenderly.co pnpm test   # Sepolia フォークのテスト
```
