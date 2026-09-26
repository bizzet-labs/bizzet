import { type Address, encodeFunctionData, parseAbi, zeroAddress } from 'viem'
import { sepolia } from './addresses/sepolia.ts'

const safeAbi = parseAbi([
  'function setup(address[] _owners, uint256 _threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
])

const proxyFactoryAbi = parseAbi([
  'function createProxyWithNonce(address _singleton, bytes initializer, uint256 saltNonce) returns (address proxy)',
  'event ProxyCreation(address indexed proxy, address singleton)',
])

const moduleSetupAbi = parseAbi(['function enableModules(address[] modules)'])

export type SafeSetup = {
  owners: readonly Address[]
  threshold: bigint
}

// Safe の setup の calldata。作成と同時に Safe4337Module を有効にし、fallback handler にも置く。
// Safe4337Module は、EntryPoint からの呼び出しを fallback handler として受けるため。
export function encodeSafeInitializer({ owners, threshold }: SafeSetup) {
  return encodeFunctionData({
    abi: safeAbi,
    functionName: 'setup',
    args: [
      owners,
      threshold,
      sepolia.safe4337.moduleSetup,
      encodeFunctionData({
        abi: moduleSetupAbi,
        functionName: 'enableModules',
        args: [[sepolia.safe4337.module]],
      }),
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

export { proxyFactoryAbi }
