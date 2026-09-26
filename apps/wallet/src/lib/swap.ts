import {
  quoteExactOutput,
  type ReceivingCurrency,
  readPermit2Allowance,
  uniswapV4,
} from '@bizzet/contracts'
import { type Address, erc20Abi, formatUnits, type PublicClient } from 'viem'

// 見積もりに上乗せする許容の幅（1%）。交換の間に価格が動いても、この範囲なら支払いを通す
export const SWAP_SLIPPAGE_BPS = 100n

// Universal Router の取引の期限。ウォレットで承認するまでの時間を見込んで 10 分とする
export const SWAP_DEADLINE_SECONDS = 600

// Permit2 が Universal Router に許す期限。次の支払いでも承認を省けるよう 30 日とする
export const PERMIT2_EXPIRATION_SECONDS = 30 * 24 * 60 * 60

const DECIMALS: Record<ReceivingCurrency, number> = { JPYC: 18, USDC: 6 }

// 受取通貨でない方の通貨。客がこちらで払うときは Uniswap v4 で交換する
export function otherCurrency(currency: ReceivingCurrency): ReceivingCurrency {
  return currency === 'JPYC' ? 'USDC' : 'JPYC'
}

// 見積もりに許容の幅を足した、客が払ってよい量の上限。端数は切り上げる
export function maxAmountIn(quote: bigint): bigint {
  const bps = 10_000n + SWAP_SLIPPAGE_BPS
  return (quote * bps + 9_999n) / 10_000n
}

// 取引の期限（unix 秒）
export function swapDeadline(nowMs: number): bigint {
  return BigInt(Math.floor(nowMs / 1000) + SWAP_DEADLINE_SECONDS)
}

// Permit2 の approve に渡す期限（unix 秒）
export function permit2Expiration(nowMs: number): number {
  return Math.floor(nowMs / 1000) + PERMIT2_EXPIRATION_SECONDS
}

export type SwapStep = 'erc20Approve' | 'permit2Approve' | 'swap'

// 交換して支払うまでに客がウォレットで承認する取引を決める。
// ERC-20 の Permit2 への許可が足りなければ approve、Permit2 の Universal Router への
// 許可が足りないか取引の期限までに切れるなら Permit2 の approve を、交換の前に挟む
export function planSwapSteps(params: {
  erc20Allowance: bigint
  permit2Allowance: { amount: bigint; expiration: number }
  amountInMaximum: bigint
  deadline: bigint
}): SwapStep[] {
  const steps: SwapStep[] = []
  if (params.erc20Allowance < params.amountInMaximum) steps.push('erc20Approve')
  const { amount, expiration } = params.permit2Allowance
  if (amount < params.amountInMaximum || BigInt(expiration) < params.deadline) {
    steps.push('permit2Approve')
  }
  steps.push('swap')
  return steps
}

// 見積もりから、1 USDC あたりの JPYC の量を求める。JPYC は 1 JPYC ≒ 1 円として円のレートの表示に使う
export function jpycPerUsdc(params: {
  jpycAmount: bigint
  usdcAmount: bigint
}): number | null {
  if (params.usdcAmount <= 0n) return null
  const jpyc = Number(formatUnits(params.jpycAmount, DECIMALS.JPYC))
  const usdc = Number(formatUnits(params.usdcAmount, DECIMALS.USDC))
  return jpyc / usdc
}

export type SwapQuote = {
  tokenIn: Address
  tokenOut: Address
  amountOut: bigint
  // Uniswap v4 の見積もりで、受取先に amountOut を届けるのに客が払う tokenIn の量
  amountIn: bigint
  amountInMaximum: bigint
}

// 受取先に amountOut を届けるための見積もりを取り、許容の幅を足した上限を添える
export async function quoteSwap(
  client: PublicClient,
  params: { tokenIn: Address; tokenOut: Address; amountOut: bigint },
): Promise<SwapQuote> {
  const amountIn = await quoteExactOutput(client, params)
  if (amountIn <= 0n) throw new Error('見積もりが 0 です')
  return { ...params, amountIn, amountInMaximum: maxAmountIn(amountIn) }
}

// 客の許可の状態を読み、交換までに必要な取引を決める
export async function planSwap(
  client: PublicClient,
  params: { owner: Address; quote: SwapQuote; deadline: bigint },
): Promise<SwapStep[]> {
  const { owner, quote, deadline } = params
  const [erc20Allowance, permit2Allowance] = await Promise.all([
    client.readContract({
      address: quote.tokenIn,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, uniswapV4.permit2],
    }),
    readPermit2Allowance(client, { owner, token: quote.tokenIn }),
  ])
  return planSwapSteps({
    erc20Allowance,
    permit2Allowance,
    amountInMaximum: quote.amountInMaximum,
    deadline,
  })
}
