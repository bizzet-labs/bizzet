---
theme: default
title: bizzet Pitch (3 min)
info: |
  ETHGlobal Tokyo 2026 pitch video outline (3 minutes / 180 seconds)
class: text-center
highlighter: shiki
transition: fade
mdc: true
---

# bizzet
### A wallet built for business.

<div class="pt-8 opacity-70 text-sm">ETHGlobal Tokyo 2026</div>

<!--
180 seconds total. Problem 20s → Solution 20s → Demo 100s → Technical highlights 30s → Results & close 10s.
-->

---

# Problem
<TimeChip from="0:00" to="0:20" :seconds="20" unit="s" />

<div class="mt-8 text-lg leading-relaxed">

- Crypto wallets are built <b>for individuals</b>. There's no real way for a business to receive and manage crypto sales.
- Routing payments through a processor means underwriting and fees, and personal wallets have <b>no concept of "who is allowed to withdraw."</b>

</div>

<!-- Screen: a title slide that shows the problem at a glance (a payment processor crossed out, a personal wallet crossed out) -->

---

# Solution
<TimeChip from="0:20" to="0:40" :seconds="20" unit="s" />

<div class="mt-4 text-lg leading-relaxed">

**bizzet**: "A wallet built for business."

- Customer payments land directly in the store's wallet, and sales flow up into the headquarters wallet.
- Groups for HQ and stores, Owner/Approver/Viewer roles, two-approval withdrawals, and a single source of truth for payout addresses via ENS.

</div>

<FlowDiagram
  customer-label="🧑<br />Customer"
  store-label="🏪<br />Store Wallet"
  hq-label="🏢<br />HQ Wallet"
  button-label="▶ Play the payment flow"
/>

---

# Demo ①: Customer payment
<TimeChip from="0:40" to="1:20" :seconds="40" unit="s" />

<div class="mt-8 text-lg leading-relaxed">

1. Scan the price tag's QR code to open the checkout page (`/pay/[name]`) <span class="opacity-50 text-sm">(P-02)</span>
2. Resolve the store's ENS name (e.g. `shibuya.bizzet.eth`) via the Universal Resolver to show the payout address and currency (JPYC / USDC) <span class="opacity-50 text-sm">(P-06)</span>
3. Send an ERC-20 from the customer's wallet; the page flips from "processing" to "paid" <span class="opacity-50 text-sm">(P-04)</span>

</div>

<!-- Screen: live device (or screen recording). Walk QR → checkout page → payment → "paid" end to end. -->

---

# Demo ②: Running the business
<TimeChip from="1:20" to="2:20" :seconds="60" unit="s" />

<div class="mt-6 text-base leading-relaxed">

1. Open the group list to check each store's ENS name, Safe status, and balance <span class="opacity-50 text-sm">(D-11 / DS-11)</span>
2. Add a new store and show the Safe setup and ENS registration in progress <span class="opacity-50 text-sm">(D-07 / DS-12)</span>
3. Add a member, assigning a group and a role (Owner / Approver / Viewer) <span class="opacity-50 text-sm">(D-05 / DS-06,07)</span>
4. Create a withdrawal and prompt for a passkey signature in the wallet <span class="opacity-50 text-sm">(D-04,09 / DS-09, WS-06)</span>
5. The second approval executes `execTransaction`, and the withdrawal completes <span class="opacity-50 text-sm">(W-04, W-05)</span>

</div>

<!-- This already runs end to end against test data, so follow the script as rehearsed. -->

---

# Technical highlights
<TimeChip from="2:20" to="2:50" :seconds="30" unit="s" />

<div class="mt-6 text-base leading-relaxed">

- No Safe SDK: enabling Safe4337Module, creating the passkey signer, and setting owners are bundled into one `setup()` call, so a group's Safe launches in <b>a single transaction</b> (the EIP-712 `SafeOp` for Safe4337Module v0.3 is hand-rolled too)
- <b>A passkey (WebAuthn / P-256) becomes the Safe owner directly.</b> No one holds a private key, and an ERC-4337 Paymaster covers gas
- ENSv2's <b>resource-scoped roles</b> restrict which key can write the payout record, so rewriting one store name updates the payout address across every channel
- Roles v2 scopes the future auto-bridge keeper's on-chain permission to "send to the home Safe only," so a stolen keeper key still can't reach the funds

</div>

<!-- Screen: the transaction hash of a real UserOperation sent on Sepolia (Etherscan) -->

---
layout: center
class: text-center
---

# Results & close
<TimeChip from="2:50" to="3:00" :seconds="10" unit="s" />

<div class="mt-8 text-lg leading-relaxed">

32 vitest tests and 13 contract fork tests all pass<br />
A real passkey-signed transaction on Sepolia has been confirmed

<div class="mt-6 opacity-70 text-base">
Next: currency conversion at checkout time, and a zero-knowledge<br />
receipt for purchase-history-based discounts
</div>

<div class="mt-10 text-2xl">
bizzet ― a wallet built for business.
</div>

</div>

<!--
Presenter notes (not shown in the recording)
- Lock in the store name, amount, and member name used in the demo.
- Reset the Sepolia test data (Safe, members, invitations) right before recording.
- Have the Etherscan tab with the transaction hash open ahead of time.
- Rehearse the 100-second demo section at least once, and know the wait times (signing, on-chain confirmation) before recording.
-->
