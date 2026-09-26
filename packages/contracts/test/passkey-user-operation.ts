import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { network } from 'hardhat'
import { P256, WebAuthnP256 } from 'ox'
import { decodeEventLog, parseEther } from 'viem'
import {
  entryPoint07Abi,
  toPackedUserOperation,
} from 'viem/account-abstraction'
import { sepolia } from '../src/addresses/sepolia.ts'
import { signerFactoryAbi, verifiers } from '../src/passkey.ts'
import { proxyFactoryAbi } from '../src/safe.ts'
import { toSafePasskeyAccount } from '../src/user-operation.ts'

// 疑似のパスキーで署名した UserOperation を、fork 上の EntryPoint に直接渡して最後まで通す。
// バンドラーと Paymaster を使わずに、Safe の作成・署名者の作成・署名の形式を確かめる
describe('パスキーで署名した UserOperation', async () => {
  const { viem } = await network.create({ network: 'sepoliaFork' })
  const publicClient = await viem.getPublicClient()
  const [bundler] = await viem.getWalletClients()

  it('Safe と署名者を作り、取引を実行できる', async () => {
    const privateKey = P256.randomPrivateKey()
    const { x, y } = P256.getPublicKey({ privateKey })
    const signer = await publicClient.readContract({
      address: sepolia.passkey.signerFactory,
      abi: signerFactoryAbi,
      functionName: 'getSigner',
      args: [x, y, verifiers],
    })
    const proxyCreationCode = await publicClient.readContract({
      address: sepolia.safe.proxyFactory,
      abi: proxyFactoryAbi,
      functionName: 'proxyCreationCode',
    })

    const account = await toSafePasskeyAccount({
      client: publicClient,
      setup: { owners: [signer], threshold: 1n, passkeys: [{ x, y }] },
      saltNonce: 0n,
      proxyCreationCode,
      signer,
      async signChallenge(challenge) {
        const { metadata, payload } = WebAuthnP256.getSignPayload({
          challenge,
          origin: 'http://localhost:5175',
          rpId: 'localhost',
        })
        const { r, s } = P256.sign({ payload, privateKey, hash: true })
        return {
          authenticatorData: metadata.authenticatorData,
          clientDataJSON: metadata.clientDataJSON,
          r,
          s,
        }
      },
    })

    // Paymaster を使わないため、ガス代は Safe 自身が EntryPoint に前払いする
    await bundler.sendTransaction({
      to: account.address,
      value: parseEther('1'),
    })

    const { factory, factoryData } = await account.getFactoryArgs()
    const block = await publicClient.getBlock()
    const maxFeePerGas = (block.baseFeePerGas ?? 1_000_000_000n) * 2n
    const userOperation = {
      sender: account.address,
      nonce: 0n,
      factory,
      factoryData,
      callData: await account.encodeCalls([
        { to: account.address, value: 0n, data: '0x' },
      ]),
      callGasLimit: 200_000n,
      verificationGasLimit: 1_500_000n,
      preVerificationGas: 100_000n,
      maxFeePerGas,
      maxPriorityFeePerGas: maxFeePerGas,
      signature: '0x' as const,
    }
    userOperation.signature = (await account.signUserOperation(
      userOperation,
    )) as '0x'

    const hash = await bundler.writeContract({
      address: sepolia.safe4337.entryPoint,
      abi: entryPoint07Abi,
      functionName: 'handleOps',
      args: [[toPackedUserOperation(userOperation)], bundler.account.address],
      gas: 5_000_000n,
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    const event = receipt.logs
      .filter(
        (log) =>
          log.address.toLowerCase() ===
          sepolia.safe4337.entryPoint.toLowerCase(),
      )
      .map((log) => {
        try {
          return decodeEventLog({ abi: entryPoint07Abi, ...log })
        } catch {
          return undefined
        }
      })
      .find((decoded) => decoded?.eventName === 'UserOperationEvent')
    assert.ok(event, 'UserOperationEvent が出ていない')
    assert.equal(
      (event.args as { success: boolean }).success,
      true,
      '取引が失敗した',
    )

    for (const address of [account.address, signer]) {
      const code = await publicClient.getCode({ address })
      assert.ok(code && code !== '0x', `${address} にコードがない`)
    }
  })
})
