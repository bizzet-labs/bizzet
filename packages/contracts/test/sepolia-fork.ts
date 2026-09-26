import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { network } from 'hardhat'
import { type Address, decodeEventLog, getAddress, parseAbi } from 'viem'
import { sepolia } from '../src/addresses/sepolia.ts'
import { encodeCreateSafe, proxyFactoryAbi } from '../src/safe.ts'

// SEPOLIA_RPC_URL が必要。`pnpm hardhat keystore set SEPOLIA_RPC_URL` か環境変数で渡す
describe('Sepolia fork', async () => {
  const { viem } = await network.create({ network: 'sepoliaFork' })
  const publicClient = await viem.getPublicClient()
  const [deployer] = await viem.getWalletClients()

  it('使うコントラクトがすべて配置されている', async () => {
    const { p256Precompile, ...passkey } = sepolia.passkey
    const addresses: Record<string, Address> = {
      ...sepolia.safe,
      ...sepolia.safe4337,
      ...passkey,
      ...sepolia.roles,
      ...sepolia.tokens,
    }
    for (const [name, address] of Object.entries(addresses)) {
      const code = await publicClient.getCode({ address })
      assert.ok(code && code !== '0x', `${name} (${address}) にコードがない`)
    }
  })

  it('Safe4337Module を有効にした Safe を作れる', async () => {
    const owners = [deployer.account.address]
    const hash = await deployer.sendTransaction({
      to: sepolia.safe.proxyFactory,
      data: encodeCreateSafe({ owners, threshold: 1n }, BigInt(Date.now())),
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    const log = receipt.logs.find(
      (l) =>
        l.address.toLowerCase() === sepolia.safe.proxyFactory.toLowerCase(),
    )
    assert.ok(log, 'ProxyCreation が出ていない')
    const { args } = decodeEventLog({
      abi: proxyFactoryAbi,
      eventName: 'ProxyCreation',
      ...log,
    })

    const safeAbi = parseAbi([
      'function getOwners() view returns (address[])',
      'function getThreshold() view returns (uint256)',
      'function isModuleEnabled(address module) view returns (bool)',
    ])
    const read = <F extends 'getOwners' | 'getThreshold'>(functionName: F) =>
      publicClient.readContract({
        address: args.proxy,
        abi: safeAbi,
        functionName,
      })

    assert.deepEqual(
      (await read('getOwners')).map(getAddress),
      owners.map(getAddress),
    )
    assert.equal(await read('getThreshold'), 1n)
    assert.equal(
      await publicClient.readContract({
        address: args.proxy,
        abi: safeAbi,
        functionName: 'isModuleEnabled',
        args: [sepolia.safe4337.module],
      }),
      true,
    )
  })
})
