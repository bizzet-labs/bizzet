import { type Address, getAddress, type PublicClient } from 'viem'
import { normalize } from 'viem/ens'

// ENS が Sepolia に配置した ENSv2 のコントラクト。出典は ENS の公式ドキュメントの配置一覧（2026-09-27 確認）
export const ensV2 = {
  ethRegistrar: '0xabe76f6c8dfced81aa5a2bb8034202a7136b94ca',
  ethRegistry: '0x657ea849311d3d5823348dded7c2aaafb3ede09e',
  rootRegistry: '0x9703dbd26dab89504490994138cf2c575251a9ce',
  verifiableFactory: '0x9e726eb570beb6bceb495ab8cda7df517d4e841c',
  userRegistryImpl: '0xa80338aaa8d23831cea25e858d1774534abb0263',
  permissionedResolverImpl: '0x14f09fd05d4585759e54844dc9b00147131cf243',
  universalResolver: '0x5d25c1d6acbb71b7a28aa7899618a3412a8303e3',
  rentPriceOracle: '0x9b0b9c65bdaf9794ff7697e4dcfb1f50581072bb',
  mockUsdc: '0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e',
} as const satisfies Record<string, Address>

// 受取通貨を書くテキストレコードのキー
export const CURRENCY_TEXT_KEY = 'bizzet.currency'

export type ReceivingCurrency = 'JPYC' | 'USDC'

export type ResolvedGroupName = {
  name: string
  address: Address | null
  currency: ReceivingCurrency | null
  description: string | null
}

// ラベルは英小文字・数字・ハイフンの3〜32文字
export function isValidLabel(label: string): boolean {
  return /^[a-z0-9-]{3,32}$/.test(label) && normalize(label) === label
}

// Universal Resolver で、グループの名前の受取先・受取通貨・表示名を読む。
// 名前やレコードがなければ、その項目を null にして返す
export async function resolveGroupName(
  client: PublicClient,
  name: string,
): Promise<ResolvedGroupName> {
  const normalized = normalize(name)
  const universalResolverAddress = ensV2.universalResolver
  const [address, currency, description] = await Promise.all([
    client
      .getEnsAddress({ name: normalized, universalResolverAddress })
      .catch(() => null),
    client
      .getEnsText({
        name: normalized,
        key: CURRENCY_TEXT_KEY,
        universalResolverAddress,
      })
      .catch(() => null),
    client
      .getEnsText({
        name: normalized,
        key: 'description',
        universalResolverAddress,
      })
      .catch(() => null),
  ])
  return {
    name: normalized,
    address: address ? getAddress(address) : null,
    currency: currency === 'JPYC' || currency === 'USDC' ? currency : null,
    description: description || null,
  }
}
