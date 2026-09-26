import {
  type Address,
  concatHex,
  encodeFunctionData,
  encodePacked,
  getContractAddress,
  type Hex,
  keccak256,
  parseAbi,
  size,
  zeroAddress,
} from 'viem'
import { sepolia } from './addresses/sepolia.ts'
import { encodeCreateSigner, type PasskeyPublicKey } from './passkey.ts'

const safeAbi = parseAbi([
  'function setup(address[] _owners, uint256 _threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
])

const proxyFactoryAbi = parseAbi([
  'function createProxyWithNonce(address _singleton, bytes initializer, uint256 saltNonce) returns (address proxy)',
  'event ProxyCreation(address indexed proxy, address singleton)',
  'function proxyCreationCode() pure returns (bytes)',
])

const moduleSetupAbi = parseAbi(['function enableModules(address[] modules)'])

const multiSendAbi = parseAbi(['function multiSend(bytes transactions)'])

export type SafeSetup = {
  owners: readonly Address[]
  threshold: bigint
  // Safe の作成と同時に作る、パスキーの署名者。オーナーに含めた署名者のうち、まだ配置していないものを渡す
  passkeys?: readonly PasskeyPublicKey[]
  // safe4337：中継用アカウント。Safe4337Module を有効にし、fallback handler にも置く。
  // group：グループの Safe。モジュールを入れず、fallback handler に CompatibilityFallbackHandler を置く
  //（本部の Safe が店舗の Safe の取引に ERC-1271 で署名するため）
  kind?: 'safe4337' | 'group'
}

// MultiSend に渡す1件の呼び出し。operation は 0 が call、1 が delegatecall
export type MultiSendTransaction = {
  operation: 0 | 1
  to: Address
  value: bigint
  data: Hex
}

export function encodeMultiSend(transactions: readonly MultiSendTransaction[]) {
  return encodeFunctionData({
    abi: multiSendAbi,
    functionName: 'multiSend',
    args: [
      concatHex(
        transactions.map((tx) =>
          encodePacked(
            ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
            [tx.operation, tx.to, tx.value, BigInt(size(tx.data)), tx.data],
          ),
        ),
      ),
    ],
  })
}

const enableSafe4337Module = encodeFunctionData({
  abi: moduleSetupAbi,
  functionName: 'enableModules',
  args: [[sepolia.safe4337.module]],
})

// setup の中で最初に実行する処理。Safe4337Module を有効にし、パスキーがあれば署名者も作る。
// 署名者は、最初の取引の署名を検証する前に配置されている必要があるため、Safe の作成と同じ処理で作る
function encodeSetupCall(passkeys: readonly PasskeyPublicKey[]) {
  if (passkeys.length === 0) {
    return { to: sepolia.safe4337.moduleSetup, data: enableSafe4337Module }
  }
  return {
    to: sepolia.safe.multiSend,
    data: encodeMultiSend([
      {
        operation: 1,
        to: sepolia.safe4337.moduleSetup,
        value: 0n,
        data: enableSafe4337Module,
      },
      ...passkeys.map((passkey) => ({
        operation: 0 as const,
        to: sepolia.passkey.signerFactory,
        value: 0n,
        data: encodeCreateSigner(passkey),
      })),
    ]),
  }
}

// Safe の setup の calldata。Safe4337Module は、EntryPoint からの呼び出しを fallback handler として受けるため、
// モジュールとしての有効化に加えて fallback handler にも置く
export function encodeSafeInitializer({
  owners,
  threshold,
  passkeys = [],
  kind = 'safe4337',
}: SafeSetup) {
  if (kind === 'group') {
    return encodeFunctionData({
      abi: safeAbi,
      functionName: 'setup',
      args: [
        owners,
        threshold,
        zeroAddress,
        '0x',
        sepolia.safe.fallbackHandler,
        zeroAddress,
        0n,
        zeroAddress,
      ],
    })
  }
  const { to, data } = encodeSetupCall(passkeys)
  return encodeFunctionData({
    abi: safeAbi,
    functionName: 'setup',
    args: [
      owners,
      threshold,
      to,
      data,
      sepolia.safe4337.module,
      zeroAddress,
      0n,
      zeroAddress,
    ],
  })
}

// SafeProxyFactory で、SafeL2 のプロキシを作る calldata
export function encodeCreateSafe(setup: SafeSetup, saltNonce: bigint) {
  return encodeFunctionData({
    abi: proxyFactoryAbi,
    functionName: 'createProxyWithNonce',
    args: [sepolia.safe.singletonL2, encodeSafeInitializer(setup), saltNonce],
  })
}

// SafeProxyFactory v1.4.1 の createProxyWithNonce と同じ CREATE2 の計算で、配置前の Safe のアドレスを求める。
// proxyCreationCode は SafeProxyFactory の proxyCreationCode() で読み、チェーンごとに1度だけ取れば足りる
export function predictSafeAddress(
  setup: SafeSetup,
  saltNonce: bigint,
  proxyCreationCode: Hex,
) {
  return getContractAddress({
    opcode: 'CREATE2',
    from: sepolia.safe.proxyFactory,
    salt: keccak256(
      encodePacked(
        ['bytes32', 'uint256'],
        [keccak256(encodeSafeInitializer(setup)), saltNonce],
      ),
    ),
    bytecode: encodePacked(
      ['bytes', 'uint256'],
      [proxyCreationCode, BigInt(sepolia.safe.singletonL2)],
    ),
  })
}

export { proxyFactoryAbi }
