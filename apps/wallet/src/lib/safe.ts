import {
  sepolia as addresses,
  predictSafeAddress,
  proxyFactoryAbi,
  type SafeSetup,
  toSafePasskeyAccount,
} from '@bizzet/contracts'
import { WebAuthnP256 } from 'ox'
import type { Address, Hex } from 'viem'
import { publicClient } from './chain.js'
import { RP_ID, type StoredPasskey, toCoordinates } from './passkey.js'

// 仮置き：検証用に、オーナーがこのパスキーの署名者1人・しきい値 1 の Safe を使う。
// グループの Safe（本部・店舗）は、メンバー管理とバックエンドを決めた時点で置き換える
const SALT_NONCE = 0n

let proxyCreationCode: Promise<Hex> | undefined

function loadProxyCreationCode() {
  proxyCreationCode ??= publicClient.readContract({
    address: addresses.safe.proxyFactory,
    abi: proxyFactoryAbi,
    functionName: 'proxyCreationCode',
  })
  return proxyCreationCode
}

// 署名者は、Safe の作成と同じ処理で作る
function toSetup(passkey: StoredPasskey): SafeSetup {
  return {
    owners: [passkey.signer],
    threshold: 1n,
    passkeys: [toCoordinates(passkey.publicKey)],
  }
}

// 配置前でも決まる、このパスキーの Safe のアドレス
export async function getSafeAddress(passkey: StoredPasskey) {
  return predictSafeAddress(
    toSetup(passkey),
    SALT_NONCE,
    await loadProxyCreationCode(),
  )
}

export async function isSafeDeployed(address: Address) {
  const code = await publicClient.getCode({ address })
  return code !== undefined && code !== '0x'
}

// このパスキーで署名する Safe のアカウント。署名のたびに WebAuthn でパスキーに確かめさせる
export async function toPasskeySafeAccount(passkey: StoredPasskey) {
  return toSafePasskeyAccount({
    client: publicClient,
    setup: toSetup(passkey),
    saltNonce: SALT_NONCE,
    proxyCreationCode: await loadProxyCreationCode(),
    signer: passkey.signer,
    async signChallenge(challenge) {
      const { metadata, signature } = await WebAuthnP256.sign({
        credentialId: passkey.id,
        challenge,
        rpId: RP_ID,
      })
      return {
        authenticatorData: metadata.authenticatorData,
        clientDataJSON: metadata.clientDataJSON,
        r: signature.r,
        s: signature.s,
      }
    },
  })
}
