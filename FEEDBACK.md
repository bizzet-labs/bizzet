# Uniswap v4 integration feedback

Bizzet lets a customer pay a store in JPYC or USDC while the store's Safe always receives its own currency. We use one Universal Router `execute` per payment: `V4_SWAP` with `SWAP_EXACT_OUT_SINGLE → SETTLE_ALL → TAKE(recipient = store Safe)`, paid by the customer through Permit2. All of it runs against the Sepolia v4 deployment and is proven by a Hardhat 3 Sepolia-fork test (mint full-range liquidity, then JPYC→USDC and USDC→JPYC exact-out swaps to a fresh recipient). This is what we actually hit while building it during ETHGlobal Tokyo.

## What worked well

- **Exact-out with `TAKE` to an arbitrary recipient** is exactly the primitive a payments app needs: the merchant gets precisely `amountOut`, the payer is capped by `amountInMaximum`, and no intermediate custody is needed. It worked on the first fork run once the encoding was right.
- **Quoter numbers match execution exactly** on the same state (`quoteExactOutputSingle` result == amount actually pulled), which makes "price shown on the payment screen" trustworthy.
- **Action-based encoding** (`bytes actions` + `bytes[] params`) is compact and composable; the same pattern worked for PositionManager `modifyLiquidities` (`MINT_POSITION → SETTLE_PAIR`).

## Friction we hit

1. **Struct layout on `main` differs from what is deployed.** `IV4Router.ExactOutputSingleParams` on v4-periphery `main` now has `uint256 minHopPriceX36` between `amountInMaximum` and `hookData`. The Sepolia Universal Router (`0x3A9D…F98b`) uses the older layout without it. Encoding against `main` silently produces wrong calldata. Docs/deployment pages should state which periphery commit each deployment was built from, and the SDK/docs should flag the breaking struct change.
2. **No versioned ABI/JSON per deployment.** We had to reconstruct ABIs by hand (`parseAbi`) from Solidity sources for Universal Router, V4Quoter, StateView, PositionManager and Permit2. A published per-chain ABI bundle (or verified source on every testnet explorer) would remove most of the guesswork.
3. **Action byte values live only in `Actions.sol`.** The docs explain actions conceptually but the numeric values (`SWAP_EXACT_OUT_SINGLE = 0x08`, `SETTLE_ALL = 0x0c`, `TAKE = 0x0e`, `MINT_POSITION = 0x02`, `SETTLE_PAIR = 0x0d`) and the exact per-action param tuples (e.g. `TAKE(currency, recipient, amount)` with `0` meaning "open delta") had to be read from source. A single reference table in the docs would help a lot.
4. **Quoter is `nonpayable` and reverts internally.** It must be called via `eth_call`/`simulateContract`; `readContract` with a `view` ABI is the natural first attempt and is wrong. Worth one line in the Quoter docs.
5. **Two-layer approvals are easy to get wrong.** ERC-20 → Permit2, then Permit2 `approve(token, spender, uint160, uint48)` → Universal Router (for swaps) *and separately* → PositionManager (for liquidity). The failure mode when one layer is missing is an opaque revert. A "minimum approvals per entry point" checklist would save time.
6. **Testnet pools exist but have no in-range liquidity.** Our JPYC/USDC pool was initialized but had zero in-range liquidity, so the pool was unusable for payments until we minted a full-range position ourselves. Computing liquidity from token amounts needed a hand port of `LiquidityAmounts` plus the full-range `MIN/MAX_SQRT_PRICE` constants; a small TS helper for "full-range position from amounts" in the SDK would lower the barrier for hackathon teams.
7. **Currency ordering is implicit.** `zeroForOne` and `currency0/currency1` depend on address sort order (USDC < JPYC on Sepolia), which is easy to invert. Docs examples always use ETH as currency0, which hides this.

## Suggestions

- Publish a per-chain "deployment manifest" (addresses + git commit + ABIs).
- Add an actions reference table (byte value, params tuple, who pays / who receives).
- Ship minimal viem-first examples (no SDK) for: exact-out swap to recipient via Universal Router, V4Quoter via `eth_call`, and full-range mint via PositionManager.
