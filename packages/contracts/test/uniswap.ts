import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { network } from 'hardhat'
import {
  type Address,
  encodeAbiParameters,
  type Hex,
  keccak256,
  maxUint160,
  parseAbiParameters,
  parseUnits,
  toHex,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { sepolia } from '../src/addresses/sepolia.ts'
import { erc20Abi } from '../src/safe-transaction.ts'
import {
  addFullRangeLiquidity,
  encodeErc20ApproveToPermit2,
  encodePermit2Approve,
  encodeSwapExactOutputToRecipient,
  quoteExactOutput,
  readPermit2Allowance,
  readPoolState,
} from '../src/uniswap.ts'

const { jpyc, usdc } = sepolia.tokens

// JPYC/USDC のプールに全範囲の流動性を入れ、客が exact-out で交換した tokenOut が
// 受取先（店舗の Safe の代わりの新しいアドレス）にちょうど届くことを fork 上で確かめる
describe('Uniswap v4 の交換', async () => {
  const { viem, provider } = await network.create({ network: 'sepoliaFork' })
  const publicClient = await viem.getPublicClient()
  const [provisioner, customer] = await viem.getWalletClients()

  const balanceOf = (token: Address, owner: Address) =>
    publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    })

  // USDC は FiatToken の残高の mapping の位置を探し、そこへ直接残高を書く（発行権限を持たないため）
  const setUsdcBalance = async (owner: Address, amount: bigint) => {
    const token = usdc
    for (let slot = 0n; slot < 20n; slot++) {
      const key = keccak256(
        encodeAbiParameters(parseAbiParameters('address, uint256'), [
          owner,
          slot,
        ]),
      )
      const before = (await provider.request({
        method: 'eth_getStorageAt',
        params: [token, key, 'latest'],
      })) as Hex
      await provider.request({
        method: 'hardhat_setStorageAt',
        params: [token, key, toHex(amount, { size: 32 })],
      })
      if ((await balanceOf(token, owner)) === amount) return
      await provider.request({
        method: 'hardhat_setStorageAt',
        params: [token, key, toHex(BigInt(before), { size: 32 })],
      })
    }
    throw new Error(`残高の位置が見つかりません: ${token}`)
  }

  // JPYC は残高の位置が単純な mapping でないため、Sepolia で多く持つアドレスになりすまして送る
  // （2026-09-27 時点で約 300 万 JPYC を持つ）
  const JPYC_HOLDER: Address = '0x41f6b355e3fA65B797a7b1c2d503344c38ea0751'
  const sendJpyc = async (to: Address, amount: bigint) => {
    await provider.request({
      method: 'hardhat_impersonateAccount',
      params: [JPYC_HOLDER],
    })
    await provider.request({
      method: 'hardhat_setBalance',
      params: [JPYC_HOLDER, toHex(10n ** 18n)],
    })
    const holder = await viem.getWalletClient(JPYC_HOLDER)
    const hash = await holder.writeContract({
      address: jpyc,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [to, amount],
    })
    await publicClient.waitForTransactionReceipt({ hash })
  }

  const send = async (
    wallet: typeof customer,
    tx: { to: Address; data: Hex },
  ) => {
    const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    assert.equal(receipt.status, 'success')
  }

  await setUsdcBalance(provisioner.account.address, parseUnits('20', 6))
  await sendJpyc(provisioner.account.address, parseUnits('3000', 18))
  await setUsdcBalance(customer.account.address, parseUnits('100', 6))
  await sendJpyc(customer.account.address, parseUnits('10000', 18))

  it('全範囲の流動性を入れると、プールの有効な流動性が増える', async () => {
    const before = await readPoolState(publicClient)
    const result = await addFullRangeLiquidity(provisioner, publicClient, {
      amount0: parseUnits('20', 6),
      amount1: parseUnits('3000', 18),
    })
    assert.ok(result.liquidity > 0n)
    assert.equal(result.poolLiquidity, before.liquidity + result.liquidity)
  })

  // 客が Permit2 に通貨を預け、Universal Router に使わせる
  const approveCustomer = async (token: Address) => {
    await send(
      customer,
      encodeErc20ApproveToPermit2({ token, amount: 2n ** 256n - 1n }),
    )
    const expiration = Math.floor(Date.now() / 1000) + 3600
    await send(
      customer,
      encodePermit2Approve({ token, amount: maxUint160, expiration }),
    )
    const allowance = await readPermit2Allowance(publicClient, {
      owner: customer.account.address,
      token,
    })
    assert.equal(allowance.amount, maxUint160)
    assert.equal(allowance.expiration, expiration)
  }

  const swapExactOut = async (
    tokenIn: Address,
    tokenOut: Address,
    amountOut: bigint,
  ) => {
    const recipient = privateKeyToAccount(generatePrivateKey()).address
    const quoted = await quoteExactOutput(publicClient, {
      tokenIn,
      tokenOut,
      amountOut,
    })
    // 見積もりに 1% の許容の幅を足す
    const amountInMaximum = (quoted * 101n) / 100n
    const paidBefore = await balanceOf(tokenIn, customer.account.address)
    const block = await publicClient.getBlock()
    await send(
      customer,
      encodeSwapExactOutputToRecipient({
        tokenIn,
        tokenOut,
        amountOut,
        amountInMaximum,
        recipient,
        deadline: block.timestamp + 600n,
      }),
    )
    const paid =
      paidBefore - (await balanceOf(tokenIn, customer.account.address))
    assert.equal(await balanceOf(tokenOut, recipient), amountOut)
    assert.ok(paid <= amountInMaximum)
    // 同じ状態から見積もったため、見積もりと実際の支払いは一致する
    assert.equal(paid, quoted)
    return { quoted, paid }
  }

  it('JPYC を払って、受取先にちょうどの USDC を届ける', async () => {
    await approveCustomer(jpyc)
    const { paid } = await swapExactOut(jpyc, usdc, parseUnits('1', 6))
    // 1 USDC ≒ 150 JPYC の価格から大きく外れていない
    assert.ok(paid > parseUnits('140', 18) && paid < parseUnits('160', 18))
  })

  it('USDC を払って、受取先にちょうどの JPYC を届ける', async () => {
    await approveCustomer(usdc)
    const { paid } = await swapExactOut(usdc, jpyc, parseUnits('300', 18))
    assert.ok(paid > parseUnits('1.8', 6) && paid < parseUnits('2.2', 6))
  })
})
