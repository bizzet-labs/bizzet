import type { Address, Hex, PublicClient } from 'viem'
import { sepolia } from './addresses/sepolia.ts'

// Uniswap が Sepolia に配置した v4 のコントラクト。出典は Uniswap の公式ドキュメントの配置一覧で、
// どれも Sepolia 上にコードがあることを確かめた（2026-09-27 確認）
export const uniswapV4 = {
  poolManager: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
  universalRouter: '0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b',
  positionManager: '0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4',
  stateView: '0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C',
  quoter: '0x61B3f2011A92d183C7dbaDBdA940a7555Ccf9227',
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
} as const satisfies Record<string, Address>

export type PoolKey = {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  hooks: Address
}

// JPYC/USDC のプール。Sepolia で 1 USDC ≒ 150 JPYC で初期化済みの、手数料 0.01%・フックなしのもの
export const JPYC_USDC_POOL_KEY: PoolKey = {
  currency0: sepolia.tokens.usdc,
  currency1: sepolia.tokens.jpyc,
  fee: 100,
  tickSpacing: 1,
  hooks: '0x0000000000000000000000000000000000000000',
}

export type ExactOutputParams = {
  tokenIn: Address
  tokenOut: Address
  // 受取先が受け取る量（tokenOut の最小単位）
  amountOut: bigint
}

// 受取先に amountOut を届けるのに客が払う tokenIn の量を、V4Quoter で見積もる
export async function quoteExactOutput(
  _client: PublicClient,
  _params: ExactOutputParams,
): Promise<bigint> {
  throw new Error('not implemented')
}

export type SwapToRecipientParams = ExactOutputParams & {
  // 客が払ってよい tokenIn の上限（見積もりに許容の幅を足した値）
  amountInMaximum: bigint
  // 交換した tokenOut を受け取るアドレス（店舗の Safe）
  recipient: Address
  // Universal Router の execute の期限（unix 秒）
  deadline: bigint
}

// Universal Router の execute(commands, inputs, deadline) の呼び出しを組み立てる。
// 1回の取引で、客の tokenIn を Permit2 経由で払い、交換した tokenOut を recipient に直接届ける
export function encodeSwapExactOutputToRecipient(
  _params: SwapToRecipientParams,
): {
  to: Address
  data: Hex
} {
  throw new Error('not implemented')
}

// 客が Universal Router に tokenIn を使わせるための、Permit2 の approve(token, spender, amount, expiration)
export function encodePermit2Approve(_params: {
  token: Address
  amount: bigint
  expiration: number
}): { to: Address; data: Hex } {
  throw new Error('not implemented')
}

// Permit2 が Universal Router に許している量と期限を読む
export async function readPermit2Allowance(
  _client: PublicClient,
  _params: { owner: Address; token: Address },
): Promise<{ amount: bigint; expiration: number }> {
  throw new Error('not implemented')
}
