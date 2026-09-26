import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { network } from 'hardhat'
import { getAddress, parseAbi, zeroAddress } from 'viem'
import { sepolia } from '../src/addresses/sepolia.ts'
import {
  encodeCreateSafe,
  predictSafeAddress,
  proxyFactoryAbi,
} from '../src/safe.ts'
import {
  encodeErc20Transfer,
  hashSafeTransaction,
} from '../src/safe-transaction.ts'

// グループの Safe（モジュールなし、CompatibilityFallbackHandler）のアドレスの計算と、
// メンバーが署名する SafeTx のハッシュが、配置した Safe の計算と一致することを確かめる
describe('グループの Safe', async () => {
  const { viem } = await network.create({ network: 'sepoliaFork' })
  const publicClient = await viem.getPublicClient()
  const [deployer, second] = await viem.getWalletClients()

  it('アドレスの計算と SafeTx のハッシュが Safe と一致する', async () => {
    const setup = {
      owners: [deployer.account.address, second.account.address],
      threshold: 2n,
      kind: 'group' as const,
    }
    const saltNonce = BigInt(Date.now())
    const hash = await deployer.sendTransaction({
      to: sepolia.safe.proxyFactory,
      data: encodeCreateSafe(setup, saltNonce),
    })
    await publicClient.waitForTransactionReceipt({ hash })

    const proxyCreationCode = await publicClient.readContract({
      address: sepolia.safe.proxyFactory,
      abi: proxyFactoryAbi,
      functionName: 'proxyCreationCode',
    })
    const safe = predictSafeAddress(setup, saltNonce, proxyCreationCode)
    const code = await publicClient.getCode({ address: safe })
    assert.ok(code && code !== '0x', '計算したアドレスに Safe がない')

    const safeAbi = parseAbi([
      'function getThreshold() view returns (uint256)',
      'function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)',
    ])
    assert.equal(
      await publicClient.readContract({
        address: safe,
        abi: safeAbi,
        functionName: 'getThreshold',
      }),
      2n,
    )

    // fallback handler に CompatibilityFallbackHandler を置いたことを、ストレージから確かめる
    const FALLBACK_HANDLER_SLOT =
      '0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5'
    const handler = await publicClient.getStorageAt({
      address: safe,
      slot: FALLBACK_HANDLER_SLOT,
    })
    assert.equal(
      getAddress(`0x${(handler ?? '0x').slice(-40)}`),
      getAddress(sepolia.safe.fallbackHandler),
    )

    const tx = {
      to: sepolia.tokens.usdc,
      value: 0n,
      data: encodeErc20Transfer(second.account.address, 1_000_000n),
      operation: 0 as const,
      nonce: 0n,
    }
    const onchain = await publicClient.readContract({
      address: safe,
      abi: safeAbi,
      functionName: 'getTransactionHash',
      args: [
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        0n,
        0n,
        0n,
        zeroAddress,
        zeroAddress,
        tx.nonce,
      ],
    })
    assert.equal(hashSafeTransaction(safe, tx), onchain)
  })
})
