import {
  type Address,
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  type Hex,
  hashTypedData,
  type PublicClient,
  pad,
  parseAbi,
  size,
  toHex,
} from 'viem'
import {
  entryPoint07Abi,
  toSmartAccount,
  type UserOperation,
} from 'viem/account-abstraction'
import { sepolia } from './addresses/sepolia.ts'
import {
  encodeCreateSafe,
  encodeMultiSend,
  predictSafeAddress,
  type SafeSetup,
} from './safe.ts'

const safe4337ModuleAbi = parseAbi([
  'function executeUserOp(address to, uint256 value, bytes data, uint8 operation)',
])

// Safe4337Module v0.3.0（EntryPoint v0.7）が署名させる型
const safeOperationTypes = {
  SafeOp: [
    { type: 'address', name: 'safe' },
    { type: 'uint256', name: 'nonce' },
    { type: 'bytes', name: 'initCode' },
    { type: 'bytes', name: 'callData' },
    { type: 'uint128', name: 'verificationGasLimit' },
    { type: 'uint128', name: 'callGasLimit' },
    { type: 'uint256', name: 'preVerificationGas' },
    { type: 'uint128', name: 'maxPriorityFeePerGas' },
    { type: 'uint128', name: 'maxFeePerGas' },
    { type: 'bytes', name: 'paymasterAndData' },
    { type: 'uint48', name: 'validAfter' },
    { type: 'uint48', name: 'validUntil' },
    { type: 'address', name: 'entryPoint' },
  ],
} as const

// P-256 の位数。署名の s を小さい側にそろえるのに使う
const P256_N =
  0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n

// パスキーの署名。WebAuthn の応答のうち、検証に要る部分
export type PasskeySignature = {
  authenticatorData: Hex
  clientDataJSON: string
  r: bigint
  s: bigint
}

type UserOperation07 = UserOperation<'0.7'>

// Safe4337Module が検証する SafeOp のハッシュ。パスキーには、この値をチャレンジとして署名させる
export function hashSafeOperation(
  userOperation: Omit<UserOperation07, 'signature'>,
  { validAfter = 0, validUntil = 0 } = {},
) {
  const initCode =
    userOperation.factory && userOperation.factoryData
      ? concatHex([userOperation.factory, userOperation.factoryData])
      : '0x'
  const paymasterAndData = userOperation.paymaster
    ? concatHex([
        userOperation.paymaster,
        pad(toHex(userOperation.paymasterVerificationGasLimit ?? 0n), {
          size: 16,
        }),
        pad(toHex(userOperation.paymasterPostOpGasLimit ?? 0n), { size: 16 }),
        userOperation.paymasterData ?? '0x',
      ])
    : '0x'
  return hashTypedData({
    domain: {
      chainId: sepolia.chainId,
      verifyingContract: sepolia.safe4337.module,
    },
    types: safeOperationTypes,
    primaryType: 'SafeOp',
    message: {
      safe: userOperation.sender,
      nonce: userOperation.nonce,
      initCode,
      callData: userOperation.callData,
      verificationGasLimit: userOperation.verificationGasLimit,
      callGasLimit: userOperation.callGasLimit,
      preVerificationGas: userOperation.preVerificationGas,
      maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas,
      maxFeePerGas: userOperation.maxFeePerGas,
      paymasterAndData,
      validAfter,
      validUntil,
      entryPoint: sepolia.safe4337.entryPoint,
    },
  })
}

// パスキー署名者（SafeWebAuthnSignerProxy）が受け取る署名。clientDataJSON は challenge より後ろの部分だけを渡す
export function encodePasskeySignature({
  authenticatorData,
  clientDataJSON,
  r,
  s,
}: PasskeySignature) {
  const match = clientDataJSON.match(
    /^\{"type":"webauthn\.get","challenge":"[A-Za-z0-9\-_]{43}",(.*)\}$/,
  )
  if (!match?.[1]) {
    throw new Error('clientDataJSON の形式が想定と違います')
  }
  return encodeAbiParameters(
    [
      { name: 'authenticatorData', type: 'bytes' },
      { name: 'clientDataFields', type: 'string' },
      { name: 'signature', type: 'uint256[2]' },
    ],
    [authenticatorData, match[1], [r, s > P256_N / 2n ? P256_N - s : s]],
  )
}

// Safe の署名の並び。コントラクト署名は、固定部分（署名者・可変部分の位置・種別 0）と可変部分に分けて並べる。
// Safe は署名者のアドレスの昇順を求めるため、並べ替えてから詰める
export function encodeSafeSignatures(
  signatures: readonly { signer: Address; data: Hex }[],
) {
  const sorted = [...signatures].sort((a, b) =>
    a.signer.toLowerCase() < b.signer.toLowerCase() ? -1 : 1,
  )
  let offset = sorted.length * 65
  const fixed: Hex[] = []
  const dynamic: Hex[] = []
  for (const { signer, data } of sorted) {
    fixed.push(
      encodePacked(
        ['uint256', 'uint256', 'uint8'],
        [BigInt(signer), BigInt(offset), 0],
      ),
    )
    const part = encodePacked(['uint256', 'bytes'], [BigInt(size(data)), data])
    dynamic.push(part)
    offset += size(part)
  }
  return concatHex([...fixed, ...dynamic])
}

// UserOperation の signature。先頭の validAfter・validUntil は 0（期限なし）にする
function encodeUserOperationSignature(safeSignatures: Hex) {
  return encodePacked(['uint48', 'uint48', 'bytes'], [0, 0, safeSignatures])
}

// ガスの見積もり用の仮の署名。本物と同じ長さになるよう、ありうる最長に近い値を入れる
const stubPasskeySignature = encodeAbiParameters(
  [
    { name: 'authenticatorData', type: 'bytes' },
    { name: 'clientDataFields', type: 'string' },
    { name: 'signature', type: 'uint256[2]' },
  ],
  [
    '0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97631d00000000',
    '"origin":"http://somelargdomainheresothatwehaveenoughbytes.com","crossOrigin":false',
    [
      44941127272049826721201904734628716258498742255959991581049806490182030242267n,
      9910254599581058084911561569808925251374718953855182016200087235935345969636n,
    ],
  ],
)

export type ToSafePasskeyAccountParameters = {
  client: PublicClient
  setup: SafeSetup
  saltNonce: bigint
  proxyCreationCode: Hex
  // このアカウントで署名するパスキーの署名者
  signer: Address
  // パスキーにチャレンジへ署名させる処理。ブラウザでは WebAuthn、テストでは疑似の鍵を渡す
  signChallenge: (challenge: Hex) => Promise<PasskeySignature>
}

// パスキーで署名する Safe を、viem のスマートアカウントとして扱う。
// 仮置き：しきい値 1 の Safe だけを扱う。2人承認は、途中の署名の保管先を決めた時点で足す
export function toSafePasskeyAccount({
  client,
  setup,
  saltNonce,
  proxyCreationCode,
  signer,
  signChallenge,
}: ToSafePasskeyAccountParameters) {
  const address = predictSafeAddress(setup, saltNonce, proxyCreationCode)

  return toSmartAccount({
    client,
    entryPoint: {
      abi: entryPoint07Abi,
      address: sepolia.safe4337.entryPoint,
      version: '0.7',
    },
    async getAddress() {
      return address
    },
    async getFactoryArgs() {
      return {
        factory: sepolia.safe.proxyFactory,
        factoryData: encodeCreateSafe(setup, saltNonce),
      }
    },
    async encodeCalls(calls) {
      const [first] = calls
      if (calls.length === 1 && first) {
        return encodeFunctionData({
          abi: safe4337ModuleAbi,
          functionName: 'executeUserOp',
          args: [first.to, first.value ?? 0n, first.data ?? '0x', 0],
        })
      }
      return encodeFunctionData({
        abi: safe4337ModuleAbi,
        functionName: 'executeUserOp',
        args: [
          sepolia.safe.multiSendCallOnly,
          0n,
          encodeMultiSend(
            calls.map((call) => ({
              operation: 0,
              to: call.to,
              value: call.value ?? 0n,
              data: call.data ?? '0x',
            })),
          ),
          1,
        ],
      })
    },
    async getStubSignature() {
      return encodeUserOperationSignature(
        encodeSafeSignatures([{ signer, data: stubPasskeySignature }]),
      )
    },
    async signUserOperation(parameters) {
      const { chainId: _chainId, ...userOperation } = parameters
      const hash = hashSafeOperation({
        ...(userOperation as Omit<UserOperation07, 'signature'>),
        sender: address,
      })
      const signature = await signChallenge(hash)
      return encodeUserOperationSignature(
        encodeSafeSignatures([
          { signer, data: encodePasskeySignature(signature) },
        ]),
      )
    },
    async signMessage() {
      throw new Error('メッセージへの署名にはまだ対応していません')
    },
    async signTypedData() {
      throw new Error('型付きデータへの署名にはまだ対応していません')
    },
  })
}
