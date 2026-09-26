import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@bizzet/contracts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@bizzet/contracts')>()),
  quoteExactOutput: vi.fn(),
  readPermit2Allowance: vi.fn(),
}))

import {
  quoteExactOutput,
  readPermit2Allowance,
  uniswapV4,
} from '@bizzet/contracts'
import type { Address, PublicClient } from 'viem'
import {
  jpycPerUsdc,
  maxAmountIn,
  otherCurrency,
  permit2Expiration,
  planSwap,
  planSwapSteps,
  quoteSwap,
  swapDeadline,
} from './swap'

const JPYC: Address = '0x1111111111111111111111111111111111111111'
const USDC: Address = '0x2222222222222222222222222222222222222222'
const OWNER: Address = '0x3333333333333333333333333333333333333333'

describe('otherCurrency', () => {
  it('受取通貨でない方を返す', () => {
    expect(otherCurrency('JPYC')).toBe('USDC')
    expect(otherCurrency('USDC')).toBe('JPYC')
  })
})

describe('maxAmountIn', () => {
  it('見積もりに 1% を足す', () => {
    expect(maxAmountIn(1_000_000n)).toBe(1_010_000n)
  })

  it('端数は切り上げる', () => {
    expect(maxAmountIn(1n)).toBe(2n)
    expect(maxAmountIn(3_333_334n)).toBe(3_366_668n)
  })
})

describe('期限', () => {
  it('取引の期限は今から 10 分後', () => {
    expect(swapDeadline(1_700_000_000_500)).toBe(1_700_000_600n)
  })

  it('Permit2 の期限は今から 30 日後', () => {
    expect(permit2Expiration(1_700_000_000_000)).toBe(
      1_700_000_000 + 30 * 86_400,
    )
  })
})

describe('planSwapSteps', () => {
  const base = {
    amountInMaximum: 100n,
    deadline: 1_000n,
  }

  it('許可が足りていれば交換だけ', () => {
    expect(
      planSwapSteps({
        ...base,
        erc20Allowance: 100n,
        permit2Allowance: { amount: 100n, expiration: 1_000 },
      }),
    ).toEqual(['swap'])
  })

  it('ERC-20 の許可が足りなければ approve を挟む', () => {
    expect(
      planSwapSteps({
        ...base,
        erc20Allowance: 99n,
        permit2Allowance: { amount: 100n, expiration: 2_000 },
      }),
    ).toEqual(['erc20Approve', 'swap'])
  })

  it('Permit2 の許可が足りなければ Permit2 の approve を挟む', () => {
    expect(
      planSwapSteps({
        ...base,
        erc20Allowance: 100n,
        permit2Allowance: { amount: 99n, expiration: 2_000 },
      }),
    ).toEqual(['permit2Approve', 'swap'])
  })

  it('Permit2 の許可が取引の期限までに切れるなら Permit2 の approve を挟む', () => {
    expect(
      planSwapSteps({
        ...base,
        erc20Allowance: 100n,
        permit2Allowance: { amount: 100n, expiration: 999 },
      }),
    ).toEqual(['permit2Approve', 'swap'])
  })

  it('どちらも無ければ 3 つの取引を順に行う', () => {
    expect(
      planSwapSteps({
        ...base,
        erc20Allowance: 0n,
        permit2Allowance: { amount: 0n, expiration: 0 },
      }),
    ).toEqual(['erc20Approve', 'permit2Approve', 'swap'])
  })
})

describe('jpycPerUsdc', () => {
  it('1 USDC あたりの JPYC を求める', () => {
    expect(
      jpycPerUsdc({ jpycAmount: 1_500n * 10n ** 18n, usdcAmount: 10_000_000n }),
    ).toBe(150)
  })

  it('USDC が 0 なら null', () => {
    expect(jpycPerUsdc({ jpycAmount: 1n, usdcAmount: 0n })).toBeNull()
  })
})

describe('quoteSwap', () => {
  const client = {} as PublicClient

  beforeEach(() => {
    vi.mocked(quoteExactOutput).mockReset()
  })

  it('見積もりに上限を添える', async () => {
    vi.mocked(quoteExactOutput).mockResolvedValue(3_400_000n)
    const quote = await quoteSwap(client, {
      tokenIn: USDC,
      tokenOut: JPYC,
      amountOut: 500n * 10n ** 18n,
    })
    expect(quote).toEqual({
      tokenIn: USDC,
      tokenOut: JPYC,
      amountOut: 500n * 10n ** 18n,
      amountIn: 3_400_000n,
      amountInMaximum: 3_434_000n,
    })
    expect(quoteExactOutput).toHaveBeenCalledWith(client, {
      tokenIn: USDC,
      tokenOut: JPYC,
      amountOut: 500n * 10n ** 18n,
    })
  })

  it('流動性がなく見積もりに失敗したら例外を投げる', async () => {
    vi.mocked(quoteExactOutput).mockImplementation(() =>
      Promise.reject(new Error('revert')),
    )
    await expect(
      quoteSwap(client, { tokenIn: USDC, tokenOut: JPYC, amountOut: 1n }),
    ).rejects.toThrow('revert')
  })

  it('見積もりが 0 なら例外を投げる', async () => {
    vi.mocked(quoteExactOutput).mockResolvedValue(0n)
    await expect(
      quoteSwap(client, { tokenIn: USDC, tokenOut: JPYC, amountOut: 1n }),
    ).rejects.toThrow()
  })
})

describe('planSwap', () => {
  it('ERC-20 の Permit2 への許可と Permit2 の許可を読んで手順を決める', async () => {
    const readContract = vi.fn().mockResolvedValue(0n)
    const client = { readContract } as unknown as PublicClient
    vi.mocked(readPermit2Allowance).mockResolvedValue({
      amount: 10n ** 30n,
      expiration: 2_000,
    })
    const steps = await planSwap(client, {
      owner: OWNER,
      deadline: 1_000n,
      quote: {
        tokenIn: USDC,
        tokenOut: JPYC,
        amountOut: 1n,
        amountIn: 100n,
        amountInMaximum: 101n,
      },
    })
    expect(steps).toEqual(['erc20Approve', 'swap'])
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: USDC,
        functionName: 'allowance',
        args: [OWNER, uniswapV4.permit2],
      }),
    )
    expect(readPermit2Allowance).toHaveBeenCalledWith(client, {
      owner: OWNER,
      token: USDC,
    })
  })
})
