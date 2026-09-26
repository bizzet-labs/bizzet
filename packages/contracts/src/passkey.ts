import { encodeFunctionData, parseAbi } from 'viem'
import { sepolia } from './addresses/sepolia.ts'

// SafeWebAuthnSignerFactory v0.2.1。P256.Verifiers は uint176 として ABI に現れる
const signerFactoryAbi = parseAbi([
  'function createSigner(uint256 x, uint256 y, uint176 verifiers) returns (address signer)',
  'function getSigner(uint256 x, uint256 y, uint176 verifiers) view returns (address signer)',
])

// P256.Verifiers の詰め方：上位 16 ビットにプリコンパイル、下位 160 ビットに代替の検証コントラクト
export const verifiers =
  (BigInt(sepolia.passkey.p256Precompile) << 160n) |
  BigInt(sepolia.passkey.p256Fallback)

// パスキーの公開鍵（P-256 の x・y）
export type PasskeyPublicKey = {
  x: bigint
  y: bigint
}

// メンバーのパスキーから、Safe のオーナーになる署名者を作る calldata
export function encodeCreateSigner({ x, y }: PasskeyPublicKey) {
  return encodeFunctionData({
    abi: signerFactoryAbi,
    functionName: 'createSigner',
    args: [x, y, verifiers],
  })
}

export { signerFactoryAbi }
