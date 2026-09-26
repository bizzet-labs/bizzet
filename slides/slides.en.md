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
180 seconds total. Problem 20s → Solution 20s → Demo 100s → Technical highlights 30s → Results & close 10s.
-->

---

# Problem

### It's not UX. It's that businesses aren't supported.

<div class="leading-relaxed">

- The common narrative is that "UX is the biggest barrier to Web3 adoption"
- But personal wallets like <b>MetaMask</b> simply don't support <b>multi-user operation or approval flows</b>
- Routing payments through a processor means underwriting and fees, with no concept of "who is allowed to withdraw"

</div>

<!-- Say: Having worked across several Web3 businesses in Japan, the real issue isn't UX friction — it's that businesses can't run on wallets built for individuals. A wallet like MetaMask has no concept of multi-user operation or approval, so it simply isn't built for business use. -->

---

# Solution

## bizzet: a wallet built for business.

<div class="leading-relaxed">

Ships with <b>multi-user operation, roles, and approval flows</b> that personal wallets lack

</div>

<FlowDiagram
  customer-label="🧑<br />Customer"
  store-label="🏪<br />Store Wallet"
  hq-label="🏢<br />HQ Wallet"
/>

<div class="leading-relaxed">

Groups, roles (Owner / Approver / Viewer), two-approval withdrawals, and a single payout address via ENS

</div>

<!-- Say: bizzet ships with the multi-user operation and approval flow that personal wallets lack. Customer payments land directly in the store's wallet, and sales flow up into the HQ wallet. Groups and roles split up permissions, withdrawals need two approvals, and payout addresses live in one place via ENS. -->

---

# Demo ①: Customer payment

<div class="leading-relaxed">

1. Scan the price tag's QR code to open the checkout page
2. Resolve the store's ENS name to show the payout address and currency
3. Send from the wallet; the page flips from "processing" to "paid"

</div>

<!-- Say: Scanning the QR opens the checkout page. It resolves the store's ENS name via the Universal Resolver to show the currency and destination. Sending from the customer's wallet flips the page from "processing" to "paid". -->

---

# Demo ②: Running the business

<div class="leading-relaxed text-[0.85em]">

1. Check each store's ENS name, Safe status, and balance in the group list
2. Add a store; its Safe and ENS registration run automatically
3. Add a member, assigning a group and a role
4. Create a withdrawal; the wallet prompts for a passkey signature
5. The second approval executes the withdrawal

</div>

<!-- Say: The dashboard shows each store's ENS name, Safe status, and balance. Adding a store runs the Safe setup and ENS registration automatically. Adding a member assigns a group and role, and creating a withdrawal prompts a passkey signature in the wallet. The second approval executes it on-chain. -->

---

# Technical highlights

### Making multi-user operation both usable and safe

<div class="leading-relaxed text-[0.85em]">

- Bundles the Safe4337Module setup and passkey signer creation into <b>a single transaction</b>
- <b>A passkey becomes the Safe owner directly</b> — no one holds a private key
- ENSv2's <b>resource-scoped roles</b> restrict who can write the payout record
- The keeper's permission is scoped to "send to the home Safe only," so a stolen key can't reach the funds

</div>

<!-- Say: What makes this multi-user operation both usable and safe is the work underneath. No Safe SDK — Safe4337Module setup and passkey signer creation are bundled into one transaction. A passkey becomes the Safe owner directly, so no one holds a private key. ENSv2's resource-scoped roles keep the payout address in one place, and the future auto-bridge keeper's permission is scoped to a single destination so a stolen key can't reach the funds. -->

---
layout: center
class: text-center
---

# Results & close

<div class="leading-relaxed">

The multi-user operation personal wallets lack, <br />
<b>built and working end to end</b>

</div>

<div class="opacity-70 text-[0.7em]">
32 vitest tests and 13 contract fork tests all pass<br />
A real transaction has been confirmed on Sepolia
</div>

<div class="text-[1.3em]">
bizzet ― a wallet built for business.
</div>

<!--
Say: We built the multi-user operation personal wallets lack, all the way to a real transaction on Sepolia. bizzet — a wallet built for business.

Presenter notes (not shown in the recording)
- Lock in the store name, amount, and member name used in the demo.
- Reset the Sepolia test data (Safe, members, invitations) right before recording.
- Have the Etherscan tab with the transaction hash open ahead of time.
- Rehearse the 100-second demo section at least once, and know the wait times (signing, on-chain confirmation) before recording.
-->
