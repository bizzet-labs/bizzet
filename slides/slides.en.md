---
theme: default
title: bizzet Pitch
info: |
  ETHGlobal Tokyo 2026 pitch deck
class: text-center
highlighter: shiki
transition: fade
mdc: true
---

# bizzet
### A wallet built for business.

<div class="opacity-60">ETHGlobal Tokyo 2026</div>

<!--
180 seconds total. Problem 15s → Solution 15s → Demo 110s → Tech 30s → Close 10s.
Slides carry only a headline and a few words; everything else is narrated.
-->

---

# Problem

### It's not UX. Businesses can't operate a wallet.

<div class="leading-relaxed text-[1.1em]">

Personal wallets: one person, one key, no approvals

</div>

<!-- Say: People say UX is the barrier to Web3. Before that, there is a simpler problem: a business can't use a wallet the way it runs today. Personal wallets assume one person holding one key, with no shared operation and no approvals. -->

---

# Solution

## bizzet — a wallet built for business.

<FlowDiagram
  customer-label="🧑<br />Customer"
  store-label="🏪<br />Store"
  hq-label="🏢<br />HQ"
/>

<div class="leading-relaxed">

Roles / two-person approval / receive by ENS name

</div>

<!-- Say: bizzet is a wallet built for business. Customers pay to a store's name, and sales roll up to headquarters. Members have roles, and a payout needs two approvals. -->

---
layout: center
class: text-center
---

# Demo

<div class="leading-relaxed text-[1.1em]">

Create a store → a customer pays → pay out the sales

</div>

<!--
Screen share from here. One person, one laptop.

1. Create a store (20s)
   Add a store in the dashboard with a label (e.g. shibuya). The group list shows shibuya.bizzet.eth and the Safe status.
   Say: An HQ Owner adds a store. Typing a label is all it takes: an ENSv2 subname is registered, and the receiving Safe and currency are written to that name.

2. A customer pays (30s)
   Open the price-tag page /pay, show the QR, follow its link to /pay/shibuya.bizzet.eth. The store name, recipient and currency appear. Paying in USDC shows a Uniswap v4 quote. Send from MetaMask: "Pending" → "Paid".
   Say: The customer just scans this QR. The payment page resolves the store's name through ENS and shows the recipient and currency. If the customer pays in the other currency, Uniswap v4 swaps it and delivers it straight to the store's Safe. After sending, the status goes from pending to paid.

3. Pay out the sales (60s)
   The store page shows the deposit and balance. Create a payout. In window A (member 1) sign with a passkey on the approval screen. In window B (member 2) sign again: it executes, and the transaction appears on Etherscan.
   Say: That payment is already in the store's deposits and balance. Now we pay it out. In the wallet, HQ members approve with their passkeys. One is not enough. The moment the second member approves, the Safe transaction executes on-chain.
-->

---

# Tech

<div class="leading-relaxed">

- Passkey = Safe owner (no private keys)
- Store Safes are approved by the HQ Safe (nested signature)
- ENSv2: each store's name holds its recipient and currency
- Uniswap v4: swapped funds go straight to the store

</div>

<!-- Say: Four things under the hood. Passkeys are the Safe owners, so nobody holds a private key. A store Safe's owner is the HQ Safe, and two HQ signatures are nested to pass the store's transaction. On ENSv2 we run our own subname registry and write each store's recipient and currency to its name. Uniswap v4 swaps in one Universal Router transaction and delivers the output straight to the store's Safe. -->

---
layout: center
class: text-center
---

# bizzet — a wallet built for business.

<div class="opacity-70 text-[0.7em]">
23 Sepolia fork tests and 76 vitest tests, all passing
</div>

<!--
Say: All of it is backed by code and tests running on Sepolia. bizzet, a wallet built for business.

Before recording
- Decide the store name, amount and member names
- Create three HQ members, register each passkey on this laptop, and deploy the HQ Safe (two of them will approve)
- Run ens:setup to register the HQ name and uniswap:liquidity to add pool liquidity
- Open two browser windows (separate profiles) logged in to the wallet as member 1 and member 2
- Fund MetaMask on this laptop with JPYC or USDC plus Sepolia ETH for gas
- Rehearse once end to end and note the waits for signing and confirmations
-->
