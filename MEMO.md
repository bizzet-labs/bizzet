
## ピッチ動画の台本（3分）

### 日本語

**課題（0:00–0:15）**
Web3 の壁は UX だと言われますが、その手前に、企業が今の業務のままではウォレットを使えないという課題があります。個人向けウォレットは1人が1つの鍵を持つ前提で、複数人での運用も承認もありません。

**解決策（0:15–0:30）**
bizzet は、ビジネスのためのウォレットです。客の支払いは店舗の名前あてに入り、売上は本部に集まります。メンバーにはロールがあり、出金には2人の承認が要ります。

**デモ 1：店舗を作る（0:30–0:50）**
本部の Owner が店舗を追加します。ラベルを入れるだけで、ENSv2 のサブネームが登録され、受取先の Safe と通貨がその名前に書き込まれます。

**デモ 2：客が払う（0:50–1:20）**
客はこの QR を読むだけです。決済ページは店舗の名前を ENS で解決し、宛先と通貨を出します。店舗と違う通貨で払うときは、Uniswap v4 で交換して店舗の Safe に直接届けます。送ると「処理中」から「済」に変わります。

**デモ 3：売上を出金する（1:20–2:20）**
いまの支払いが、店舗の入金と残高に反映されています。この売上を出金します。ウォレットでは、本部のメンバーがパスキーで承認します。1人では動きません。2人目が承認した時点で、Safe の取引がオンチェーンで実行されます。

**技術（2:20–2:50）**
裏側は4つです。パスキーがそのまま Safe のオーナーになるので、誰も秘密鍵を持ちません。店舗の Safe のオーナーは本部の Safe で、本部の2人の署名を入れ子にして店舗の取引を通します。ENSv2 では自前のサブネームのレジストリを持ち、店舗ごとの名前に受取先と通貨を書きます。Uniswap v4 は Universal Router の1回の取引で、交換した通貨を店舗の Safe に直接届けます。

**しめ（2:50–3:00）**
すべて Sepolia で動くコードとテストで裏付けています。bizzet、ビジネスのための、ウォレット。

### English

**Problem (0:00–0:15)**
People say UX is the barrier to Web3. Before that, there is a simpler problem: a business can't use a wallet the way it runs today. Personal wallets assume one person holding one key, with no shared operation and no approvals.

**Solution (0:15–0:30)**
bizzet is a wallet built for business. Customers pay to a store's name, and sales roll up to headquarters. Members have roles, and a payout needs two approvals.

**Demo 1: Create a store (0:30–0:50)**
An HQ Owner adds a store. Typing a label is all it takes: an ENSv2 subname is registered, and the receiving Safe and currency are written to that name.

**Demo 2: A customer pays (0:50–1:20)**
The customer just scans this QR. The payment page resolves the store's name through ENS and shows the recipient and currency. If the customer pays in the other currency, Uniswap v4 swaps it and delivers it straight to the store's Safe. After sending, the status goes from pending to paid.

**Demo 3: Pay out the sales (1:20–2:20)**
That payment is already in the store's deposits and balance. Now we pay it out. In the wallet, HQ members approve with their passkeys. One is not enough. The moment the second member approves, the Safe transaction executes on-chain.

**Tech (2:20–2:50)**
Four things under the hood. Passkeys are the Safe owners, so nobody holds a private key. A store Safe's owner is the HQ Safe, and two HQ signatures are nested to pass the store's transaction. On ENSv2 we run our own subname registry and write each store's recipient and currency to its name. Uniswap v4 swaps in one Universal Router transaction and delivers the output straight to the store's Safe.

**Close (2:50–3:00)**
All of it is backed by code and tests running on Sepolia. bizzet, a wallet built for business.
