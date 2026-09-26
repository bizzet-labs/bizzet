import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { network } from 'hardhat'
import { type Hex, P256, WebAuthnP256 } from 'ox'
import {
  type Address,
  decodeEventLog,
  encodeAbiParameters,
  keccak256,
  parseAbi,
  parseEther,
} from 'viem'
import {
  entryPoint07Abi,
  toPackedUserOperation,
} from 'viem/account-abstraction'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { sepolia } from '../src/addresses/sepolia.ts'
import {
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
  encodeErc20Transfer,
  encodeExecTransaction,
  encodeSafeTransactionData,
  erc20Abi,
  hashNestedSafeTransaction,
  hashSafeMessage,
  hashSafeTransaction,
  safeExecutionEventsAbi,
} from '../src/safe-transaction.ts'
import {
  encodeNestedSafeSignature,
  encodePasskeySignature,
  encodeSafeSignatures,
  toSafePasskeyAccount,
} from '../src/user-operation.ts'

const ORIGIN = 'http://localhost:5175'
const RP_ID = 'localhost'

// Safe v1.4.1 の CompatibilityFallbackHandler のうち、SafeMessage のハッシュを返す関数
const fallbackHandlerAbi = parseAbi([
  'function getMessageHashForSafe(address safe, bytes message) view returns (bytes32)',
])

// USDC（FiatTokenV2_2）の balanceAndBlacklistStates のスロット。fork 上で balanceOf を debug_traceCall して求めた
const USDC_BALANCE_SLOT = 9n

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

// 店舗の Safe（オーナーは本部の Safe だけ、しきい値 1）の取引を、本部のオーナー2人の承認で通す。
// 各メンバーは、本部の Safe をドメインにした SafeMessage（中身は店舗の SafeTx の元のバイト列）にパスキーで署名し、
// その2つを本部の Safe の署名の並びにしたものを、店舗の Safe への本部のコントラクト署名として渡す
describe('店舗の Safe の入れ子の2人承認', async () => {
  const { viem, networkHelpers } = await network.create({
    network: 'sepoliaFork',
  })
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

  const hqSetup = {
    owners: keys.map((k) => k.signer),
    threshold: 2n,
    kind: 'group' as const,
  }
  const hqSaltNonce = BigInt(Date.now())
  const hq = predictSafeAddress(hqSetup, hqSaltNonce, proxyCreationCode)
  const storeSetup = { owners: [hq], threshold: 1n, kind: 'group' as const }
  const storeSaltNonce = hqSaltNonce + 1n
  const store = predictSafeAddress(
    storeSetup,
    storeSaltNonce,
    proxyCreationCode,
  )

  // 残高が 0 から始まるよう、使われていないアドレスに送る
  const recipient = privateKeyToAccount(generatePrivateKey()).address
  const amount = 25n * 10n ** 6n
  const tx = {
    to: sepolia.tokens.usdc,
    value: 0n,
    data: encodeErc20Transfer(recipient, amount),
    operation: 0 as const,
    nonce: 0n,
  }
  const safeTxHash = hashSafeTransaction(store, tx)
  const messageHash = hashNestedSafeTransaction(hq, store, tx)

  const usdcBalance = (holder: Address) =>
    publicClient.readContract({
      address: sepolia.tokens.usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [holder],
    })

  function nestedSignature(signers: typeof keys, hash: Hex.Hex) {
    return encodeNestedSafeSignature(
      hq,
      encodeSafeSignatures(
        signers.map((k) => ({
          signer: k.signer,
          data: encodePasskeySignature(signWithPasskey(k.privateKey, hash)),
        })),
      ),
    )
  }

  it('SafeTx の元のバイト列のハッシュは SafeTx のハッシュと一致する', () => {
    assert.equal(keccak256(encodeSafeTransactionData(store, tx)), safeTxHash)
  })

  it('本部のオーナー2人の署名で、本部・店舗の Safe の配置と店舗の execTransaction を1つの UserOperation で実行できる', async () => {
    const [first, second] = keys
    assert.ok(first && second)

    // 配置前の店舗の Safe のアドレスに USDC を入れておく
    await networkHelpers.setStorageAt(
      sepolia.tokens.usdc,
      keccak256(
        encodeAbiParameters(
          [{ type: 'address' }, { type: 'uint256' }],
          [store, USDC_BALANCE_SLOT],
        ),
      ),
      100n * 10n ** 6n,
    )
    assert.equal(await usdcBalance(store), 100n * 10n ** 6n)

    const signatures = nestedSignature([first, second], messageHash)

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
        data: encodeCreateSafe(hqSetup, hqSaltNonce),
      },
      {
        to: sepolia.safe.proxyFactory,
        value: 0n,
        data: encodeCreateSafe(storeSetup, storeSaltNonce),
      },
      ...keys.map((k) => ({
        to: sepolia.passkey.signerFactory,
        value: 0n,
        data: encodeCreateSigner(k),
      })),
      { to: store, value: 0n, data: encodeExecTransaction(tx, signatures) },
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
      callGasLimit: 4_000_000n,
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
      gas: 12_000_000n,
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    const executed = receipt.logs
      .filter((log) => log.address.toLowerCase() === store.toLowerCase())
      .map((log) => {
        try {
          return decodeEventLog({ abi: safeExecutionEventsAbi, ...log })
        } catch {
          return undefined
        }
      })
      .find((decoded) => decoded?.eventName === 'ExecutionSuccess')
    assert.ok(executed, '店舗の Safe の ExecutionSuccess が出ていない')
    assert.equal(executed.args.txHash, safeTxHash)
    assert.equal(await usdcBalance(recipient), amount)
    assert.equal(await usdcBalance(store), 100n * 10n ** 6n - amount)
  })

  it('手元で計算した SafeMessage のハッシュが、fallback handler の getMessageHashForSafe と一致する', async () => {
    const onChain = await publicClient.readContract({
      address: sepolia.safe.fallbackHandler,
      abi: fallbackHandlerAbi,
      functionName: 'getMessageHashForSafe',
      args: [hq, encodeSafeTransactionData(store, tx)],
    })
    assert.equal(onChain, messageHash)
  })

  it('本部のオーナー1人の署名では、店舗の execTransaction が通らない', async () => {
    const [, , third] = keys
    assert.ok(third)
    const next = { ...tx, nonce: 1n }
    const signatures = nestedSignature(
      [third],
      hashNestedSafeTransaction(hq, store, next),
    )
    await assert.rejects(
      bundler.sendTransaction({
        to: store,
        data: encodeExecTransaction(next, signatures),
        gas: 1_000_000n,
      }),
    )
  })

  // v1.4.1 の Safe はコントラクト署名のオーナーにハッシュではなく元のバイト列を渡すため、
  // SafeMessage の中身を abi.encode(safeTxHash) にした署名は通らない
  it('SafeMessage の中身を SafeTx のハッシュにした署名では、店舗の execTransaction が通らない', async () => {
    const [first, second] = keys
    assert.ok(first && second)
    const next = { ...tx, nonce: 1n }
    const signatures = nestedSignature(
      [first, second],
      hashSafeMessage(
        hq,
        encodeAbiParameters(
          [{ type: 'bytes32' }],
          [hashSafeTransaction(store, next)],
        ),
      ),
    )
    await assert.rejects(
      bundler.sendTransaction({
        to: store,
        data: encodeExecTransaction(next, signatures),
        gas: 1_000_000n,
      }),
    )
  })

  it('店舗の SafeTx のハッシュに直接署名しても、店舗の execTransaction は通らない', async () => {
    const [first, second] = keys
    assert.ok(first && second)
    const next = { ...tx, nonce: 1n }
    const signatures = nestedSignature(
      [first, second],
      hashSafeTransaction(store, next),
    )
    await assert.rejects(
      bundler.sendTransaction({
        to: store,
        data: encodeExecTransaction(next, signatures),
        gas: 1_000_000n,
      }),
    )
  })

  it('2人の署名なら、配置済みの店舗の Safe で次のノンスも実行できる', async () => {
    const [first, , third] = keys
    assert.ok(first && third)
    const next = { ...tx, nonce: 1n }
    const before = await usdcBalance(recipient)
    const signatures = nestedSignature(
      [first, third],
      hashNestedSafeTransaction(hq, store, next),
    )
    await bundler.sendTransaction({
      to: store,
      data: encodeExecTransaction(next, signatures),
      gas: 1_000_000n,
    })
    assert.equal(await usdcBalance(recipient), before + amount)
  })
})
