import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { network } from 'hardhat'
import { type Hex, P256, WebAuthnP256 } from 'ox'
import { type Address, decodeEventLog, parseEther } from 'viem'
import {
  entryPoint07Abi,
  toPackedUserOperation,
} from 'viem/account-abstraction'
import { sepolia } from '../src/addresses/sepolia.ts'
import {
  EIP1271_MAGIC_VALUE,
  encodeCreateSigner,
  signerFactoryAbi,
  verifiers,
} from '../src/passkey.ts'
import {
  encodeCreateSafe,
  predictSafeAddress,
  proxyFactoryAbi,
} from '../src/safe.ts'
import {
  encodeExecTransaction,
  hashSafeTransaction,
  safeExecutionEventsAbi,
} from '../src/safe-transaction.ts'
import {
  encodePasskeySignature,
  encodeSafeSignatures,
  toSafePasskeyAccount,
} from '../src/user-operation.ts'

const ORIGIN = 'http://localhost:5175'
const RP_ID = 'localhost'

// 疑似のパスキーで、チャレンジに WebAuthn の形式で署名する
function signWithPasskey(privateKey: Hex.Hex, challenge: Hex.Hex) {
  const { metadata, payload } = WebAuthnP256.getSignPayload({
    challenge,
    origin: ORIGIN,
    rpId: RP_ID,
  })
  const { r, s } = P256.sign({ payload, privateKey, hash: true })
  return {
    authenticatorData: metadata.authenticatorData,
    clientDataJSON: metadata.clientDataJSON,
    r,
    s,
  }
}

// 本部の Safe（しきい値 2、オーナーはパスキーの署名者）の2人承認を、ウォレットと同じ手順で通す。
// 各メンバーは SafeTx のハッシュに直接パスキーで署名し、署名がそろったら最後のメンバーが
// 自分のパスキーの ERC-4337 アカウントから、Safe と署名者の配置と execTransaction をまとめて送る
describe('本部の Safe の2人承認', async () => {
  const { viem } = await network.create({ network: 'sepoliaFork' })
  const publicClient = await viem.getPublicClient()
  const [bundler] = await viem.getWalletClients()

  const proxyCreationCode = await publicClient.readContract({
    address: sepolia.safe.proxyFactory,
    abi: proxyFactoryAbi,
    functionName: 'proxyCreationCode',
  })

  const keys = await Promise.all(
    [0, 1, 2].map(async () => {
      const privateKey = P256.randomPrivateKey()
      const { x, y } = P256.getPublicKey({ privateKey })
      const signer = await publicClient.readContract({
        address: sepolia.passkey.signerFactory,
        abi: signerFactoryAbi,
        functionName: 'getSigner',
        args: [x, y, verifiers],
      })
      return { privateKey, x, y, signer }
    }),
  )

  const setup = {
    owners: keys.map((k) => k.signer),
    threshold: 2n,
    kind: 'group' as const,
  }
  const saltNonce = BigInt(Date.now())
  const safe = predictSafeAddress(setup, saltNonce, proxyCreationCode)
  const recipient: Address = '0x000000000000000000000000000000000000bEEF'
  const tx = {
    to: recipient,
    value: parseEther('0.1'),
    data: '0x' as const,
    operation: 0 as const,
    nonce: 0n,
  }
  const safeTxHash = hashSafeTransaction(safe, tx)

  it('署名者のファクトリが、配置前の署名者の署名を検証できる', async () => {
    const [first] = keys
    assert.ok(first)
    const data = encodePasskeySignature(
      signWithPasskey(first.privateKey, safeTxHash),
    )
    const magic = await publicClient.readContract({
      address: sepolia.passkey.signerFactory,
      abi: signerFactoryAbi,
      functionName: 'isValidSignatureForSigner',
      args: [safeTxHash, data, first.x, first.y, verifiers],
    })
    assert.equal(magic, EIP1271_MAGIC_VALUE)

    // 別のハッシュへの署名は通らない
    const other = await publicClient.readContract({
      address: sepolia.passkey.signerFactory,
      abi: signerFactoryAbi,
      functionName: 'isValidSignatureForSigner',
      args: [`0x${'11'.repeat(32)}`, data, first.x, first.y, verifiers],
    })
    assert.notEqual(other, EIP1271_MAGIC_VALUE)
  })

  it('2人の署名で、未配置の Safe の配置と execTransaction を1つの UserOperation で実行できる', async () => {
    const [first, second] = keys
    assert.ok(first && second)

    // 配置前の Safe のアドレスにも入金できる
    await bundler.sendTransaction({ to: safe, value: parseEther('1') })

    const signatures = encodeSafeSignatures(
      [first, second].map((k) => ({
        signer: k.signer,
        data: encodePasskeySignature(signWithPasskey(k.privateKey, safeTxHash)),
      })),
    )

    // 最後に署名した2人目の、パスキーの ERC-4337 アカウント（しきい値 1 の自分用の Safe）
    const account = await toSafePasskeyAccount({
      client: publicClient,
      setup: {
        owners: [second.signer],
        threshold: 1n,
        passkeys: [{ x: second.x, y: second.y }],
      },
      saltNonce: 0n,
      proxyCreationCode,
      signer: second.signer,
      async signChallenge(challenge) {
        return signWithPasskey(second.privateKey, challenge)
      },
    })
    await bundler.sendTransaction({
      to: account.address,
      value: parseEther('1'),
    })

    const calls = [
      {
        to: sepolia.safe.proxyFactory,
        value: 0n,
        data: encodeCreateSafe(setup, saltNonce),
      },
      ...keys.map((k) => ({
        to: sepolia.passkey.signerFactory,
        value: 0n,
        data: encodeCreateSigner(k),
      })),
      { to: safe, value: 0n, data: encodeExecTransaction(tx, signatures) },
    ]

    const { factory, factoryData } = await account.getFactoryArgs()
    const block = await publicClient.getBlock()
    const maxFeePerGas = (block.baseFeePerGas ?? 1_000_000_000n) * 2n
    const userOperation = {
      sender: account.address,
      nonce: 0n,
      factory,
      factoryData,
      callData: await account.encodeCalls(calls),
      callGasLimit: 3_000_000n,
      verificationGasLimit: 1_500_000n,
      preVerificationGas: 100_000n,
      maxFeePerGas,
      maxPriorityFeePerGas: maxFeePerGas,
      signature: '0x' as const,
    }
    userOperation.signature = (await account.signUserOperation(
      userOperation,
    )) as '0x'

    const before = await publicClient.getBalance({ address: recipient })
    const hash = await bundler.writeContract({
      address: sepolia.safe4337.entryPoint,
      abi: entryPoint07Abi,
      functionName: 'handleOps',
      args: [[toPackedUserOperation(userOperation)], bundler.account.address],
      gas: 10_000_000n,
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    const executed = receipt.logs
      .filter((log) => log.address.toLowerCase() === safe.toLowerCase())
      .map((log) => {
        try {
          return decodeEventLog({ abi: safeExecutionEventsAbi, ...log })
        } catch {
          return undefined
        }
      })
      .find((decoded) => decoded?.eventName === 'ExecutionSuccess')
    assert.ok(executed, 'ExecutionSuccess が出ていない')
    assert.equal(executed.args.txHash, safeTxHash)
    assert.equal(
      await publicClient.getBalance({ address: recipient }),
      before + tx.value,
    )
  })

  it('1人の署名では execTransaction が通らない', async () => {
    const [, , third] = keys
    assert.ok(third)
    const next = { ...tx, nonce: 1n }
    const hash = hashSafeTransaction(safe, next)
    const signatures = encodeSafeSignatures([
      {
        signer: third.signer,
        data: encodePasskeySignature(signWithPasskey(third.privateKey, hash)),
      },
    ])
    await assert.rejects(
      bundler.sendTransaction({
        to: safe,
        data: encodeExecTransaction(next, signatures),
        gas: 1_000_000n,
      }),
    )
  })
})
