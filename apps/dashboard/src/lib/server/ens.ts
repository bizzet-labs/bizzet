import {
  DEFAULT_SEPOLIA_RPC_URL,
  isValidLabel,
  type ReceivingCurrency,
  type ResolvedGroupName,
  registerStoreName,
  resolveGroupName,
  storeEnsName,
  writeGroupRecords,
} from '@bizzet/contracts'
import { and, type Db, type ensSettings, eq, groups, ne } from '@bizzet/db'
import { createWalletClient, getAddress, type Hex, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { env } from '$env/dynamic/private'
import { publicClient } from './chain'

type Group = typeof groups.$inferSelect
type EnsSettings = typeof ensSettings.$inferSelect

export const RECEIVING_CURRENCIES = ['JPYC', 'USDC'] as const

export function isReceivingCurrency(
  value: unknown,
): value is ReceivingCurrency {
  return value === 'JPYC' || value === 'USDC'
}

// 組織に1行だけの ENS の設定。初期セットアップの前は null
export async function getEnsSettings(db: Db): Promise<EnsSettings | null> {
  return (await db.query.ensSettings.findFirst()) ?? null
}

// 運用者の鍵。未設定なら、名前の登録とレコードの書き込みを行わない
function operatorWallet() {
  const key = env.ENS_OPERATOR_PRIVATE_KEY
  if (!key) return null
  return createWalletClient({
    account: privateKeyToAccount(key as Hex),
    chain: sepolia,
    transport: http(env.SEPOLIA_RPC_URL || DEFAULT_SEPOLIA_RPC_URL),
  })
}

export function isEnsOperatorConfigured() {
  return Boolean(env.ENS_OPERATOR_PRIVATE_KEY)
}

// グループの ENS の名前。本部は本部の名前そのもの、店舗はラベルがあるときだけ名前を持つ
export function groupEnsName(
  group: Pick<Group, 'kind' | 'ensLabel'>,
  settings: EnsSettings | null,
): string | null {
  if (!settings) return null
  if (group.kind === 'headquarters') return settings.hqName
  return group.ensLabel ? storeEnsName(group.ensLabel, settings.hqName) : null
}

export type LabelCheck =
  | { ok: true; label: string | null }
  | { ok: false; reason: 'invalid_label' | 'label_taken' }

// 入力されたラベルを確かめる。空なら null（名前なし）として扱う
export async function checkLabel(
  db: Db,
  raw: string,
  excludeGroupId?: string,
): Promise<LabelCheck> {
  const label = raw.trim().toLowerCase()
  if (!label) return { ok: true, label: null }
  if (!isValidLabel(label)) return { ok: false, reason: 'invalid_label' }
  const taken = await db.query.groups.findFirst({
    columns: { id: true },
    where: excludeGroupId
      ? and(eq(groups.ensLabel, label), ne(groups.id, excludeGroupId))
      : eq(groups.ensLabel, label),
  })
  return taken ? { ok: false, reason: 'label_taken' } : { ok: true, label }
}

export type SyncEnsResult =
  | { ok: true; txHash: Hex }
  | {
      ok: false
      reason: 'not_configured' | 'no_label' | 'failed'
    }

// グループの名前を登録し、レコード（Safe のアドレス・受取通貨・表示名）を書く。
// 失敗してもグループは取り消さず、名前の状態を failed にして設定画面からやり直せるようにする
export async function syncGroupEns(
  db: Db,
  groupId: string,
): Promise<SyncEnsResult> {
  const [group, settings] = await Promise.all([
    db.query.groups.findFirst({ where: eq(groups.id, groupId) }),
    getEnsSettings(db),
  ])
  const wallet = operatorWallet()
  if (!group || !settings || !wallet) {
    return { ok: false, reason: 'not_configured' }
  }
  const records = {
    address: group.safeAddress ? getAddress(group.safeAddress) : null,
    currency: group.receivingCurrency,
    description: group.name,
  }
  try {
    let txHash: Hex
    if (group.kind === 'headquarters') {
      txHash = await writeGroupRecords(
        wallet,
        publicClient,
        getAddress(settings.resolverAddress),
        { ...records, name: settings.hqName },
      )
    } else {
      if (!group.ensLabel) return { ok: false, reason: 'no_label' }
      const result = await registerStoreName(wallet, publicClient, {
        subregistry: getAddress(settings.subregistryAddress),
        resolver: getAddress(settings.resolverAddress),
        expiry: BigInt(Math.floor(settings.expiresAt.getTime() / 1000)),
        label: group.ensLabel,
        hqName: settings.hqName,
        records,
      })
      txHash = result.registerTxHash ?? result.recordsTxHash
    }
    await db
      .update(groups)
      .set({ ensStatus: 'registered', ensTxHash: txHash })
      .where(eq(groups.id, group.id))
    return { ok: true, txHash }
  } catch (e) {
    console.error('ENS の名前の登録に失敗しました', e)
    await db
      .update(groups)
      .set({ ensStatus: 'failed' })
      .where(eq(groups.id, group.id))
    return { ok: false, reason: 'failed' }
  }
}

// 登録を試みてよい状態か。運用者の鍵か ENS の設定がなければ、状態を変えずに何もしない
export async function trySyncGroupEns(db: Db, groupId: string) {
  if (!isEnsOperatorConfigured()) return
  if (!(await getEnsSettings(db))) return
  await syncGroupEns(db, groupId)
}

export type GroupEnsView = {
  name: string
  resolved: ResolvedGroupName | null
  // 解決したアドレスが、データベースの Safe のアドレスと違う
  mismatch: boolean
}

// 画面に出すグループの名前。値はデータベースではなく Universal Resolver で解決したものを使う
export async function resolveGroupEns(
  group: Pick<Group, 'kind' | 'ensLabel' | 'safeAddress'>,
  settings: EnsSettings | null,
): Promise<GroupEnsView | null> {
  const name = groupEnsName(group, settings)
  if (!name) return null
  const resolved = await resolveGroupName(publicClient, name).catch((e) => {
    console.error('ENS の名前の解決に失敗しました', e)
    return null
  })
  const safe = group.safeAddress ? getAddress(group.safeAddress) : null
  const mismatch =
    resolved?.address != null && safe !== null && resolved.address !== safe
  return { name, resolved, mismatch }
}
