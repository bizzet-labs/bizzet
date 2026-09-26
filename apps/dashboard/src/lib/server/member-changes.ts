import {
  encodeAddOwner,
  encodeRemoveOwner,
  safeOwnerAbi,
} from '@bizzet/contracts'
import {
  and,
  asc,
  type Db,
  eq,
  groups,
  inArray,
  invitations,
  isNull,
  members,
  ne,
  or,
  passkeys,
  safeTransactionSignatures,
  safeTransactions,
  user,
} from '@bizzet/db'
import { type Address, decodeFunctionData, getAddress } from 'viem'
import { env } from '$env/dynamic/public'
import { m } from '$lib/paraglide/messages.js'
import { isRole, isRoleAllowedInGroup, ROLES, type Role } from '$lib/roles'
import type { Member } from './auth'
import { createSafeTransaction, getHeadquarters } from './safe'
import type { Group } from './visibility'

// メンバーの編集と削除の規則。ダッシュボードの権限は DB のロールに従い、
// 本部の Safe のオーナーの顔ぶれが変わる場合だけ、オンチェーンの変更を2人承認の提案として作る

export type { Role }
// ROLES・Role・isRole・isRoleAllowedInGroup はクライアントのフォーム検証（members/new/schema.ts など）
// からも使うため $lib/roles に置き、ここでは既存の呼び出し元向けに再公開するだけにする
export { isRole, isRoleAllowedInGroup, ROLES }

// 本部の Safe のオーナーは3人以上。1人がパスキーを失っても、残る2人で入れ替えを承認できるようにするため
export const MIN_HQ_SAFE_OWNERS = 3

// ウォレットの公開 URL。未設定ならローカル開発のウォレット（5175 番）
const DEFAULT_WALLET_URL = 'http://localhost:5175'

// 招待と追加用リンクは同じ /invite/{token} で開く。ウォレットで開くとパスキーを登録する
export function walletInviteUrl(token: string) {
  return `${env.PUBLIC_WALLET_URL || DEFAULT_WALLET_URL}/invite/${token}`
}

// 利用者に見せる理由つきの失敗。画面側で fail(status, { message }) に変える
export class MemberChangeError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message)
  }
}

// 本部の Safe のオーナーになるロールか。本部の Owner と Approver だけが署名者を Safe のオーナーに持つ
function isHqSafeOwnerRole(groupId: string, role: Role, hq: Group | undefined) {
  return hq !== undefined && groupId === hq.id && role !== 'viewer'
}

// 画面や提案の説明に出すメンバーの呼び名。名前が未入力ならメールアドレス
export function memberLabel(member: Pick<Member, 'name' | 'email'>) {
  return member.name || member.email
}

async function getSigner(db: Db, member: Member): Promise<Address | null> {
  if (!member.passkeyId) return null
  const passkey = await db.query.passkeys.findFirst({
    where: eq(passkeys.id, member.passkeyId),
  })
  return passkey ? getAddress(passkey.signer) : null
}

// 送信前・送信済みのオーナーの変更をノンスの順に当てはめた、それらの実行後のオーナーの並び。
// Safe の addOwnerWithThreshold は先頭に加え、removeOwner はその位置から外すため、同じ操作をなぞる。
// 後から作る提案の removeOwner の直前のオーナーは、この並びで決める必要がある
async function projectedOwners(db: Db, hq: Group, safe: Address) {
  const owners = (hq.safeOwners ?? []).map((o) => getAddress(o))
  const pending = await db.query.safeTransactions.findMany({
    where: and(
      eq(safeTransactions.safeAddress, safe.toLowerCase()),
      eq(safeTransactions.kind, 'owner_change'),
      inArray(safeTransactions.status, ['open', 'submitted']),
    ),
    orderBy: asc(safeTransactions.nonce),
  })
  for (const tx of pending) {
    const call = decodeFunctionData({
      abi: safeOwnerAbi,
      data: tx.data as `0x${string}`,
    })
    if (call.functionName === 'addOwnerWithThreshold') {
      owners.unshift(getAddress(call.args[0]))
    } else if (call.functionName === 'removeOwner') {
      const index = owners.indexOf(getAddress(call.args[1]))
      if (index >= 0) owners.splice(index, 1)
    }
  }
  return owners
}

type OwnerChange = {
  hq: Group
  signer: Address
  direction: 'add' | 'remove'
  target: Member
  actor: Member
  // 削除では提案の作成後にメンバーの行を消すため、対象のメンバーを紐づけない
  linkTarget: boolean
}

// 本部の Safe のオーナーを加える・外す提案を作る。本部の Safe が未設定なら何もしない（作成時の設定に含める）。
// 提案が要らない場合（既に同じ状態になる予定のとき）は null
async function proposeOwnerChange(db: Db, change: OwnerChange) {
  const { hq, signer, direction, target, actor } = change
  if (!hq.safeAddress) return null
  const safe = getAddress(hq.safeAddress)
  const threshold = BigInt(hq.safeThreshold ?? 2)
  const owners = await projectedOwners(db, hq, safe)
  const isOwner = owners.includes(signer)

  if (direction === 'add') {
    if (isOwner) return null
    return createSafeTransaction(db, {
      group: hq,
      kind: 'owner_change',
      to: safe,
      data: encodeAddOwner(signer, threshold),
      createdBy: actor.id,
      targetMemberId: change.linkTarget ? target.id : null,
      description: m.members_owner_change_add_description({
        member: memberLabel(target),
      }),
    })
  }

  if (!isOwner) return null
  if (owners.length - 1 < MIN_HQ_SAFE_OWNERS) {
    throw new MemberChangeError(
      409,
      m.members_error_min_safe_owners({ min: MIN_HQ_SAFE_OWNERS }),
    )
  }
  return createSafeTransaction(db, {
    group: hq,
    kind: 'owner_change',
    to: safe,
    data: encodeRemoveOwner(owners, signer, threshold),
    createdBy: actor.id,
    targetMemberId: change.linkTarget ? target.id : null,
    description: m.members_owner_change_remove_description({
      member: memberLabel(target),
    }),
  })
}

// 組織から Owner がいなくならないよう、対象以外に Owner が残るかを確かめる
async function ensureAnotherOwner(db: Db, target: Member) {
  if (target.role !== 'owner') return
  const others = await db.query.members.findFirst({
    where: and(eq(members.role, 'owner'), ne(members.id, target.id)),
  })
  if (!others) throw new MemberChangeError(409, m.members_error_last_owner())
}

async function loadTarget(db: Db, memberId: string) {
  const target = await db.query.members.findFirst({
    where: eq(members.id, memberId),
  })
  if (!target) throw new MemberChangeError(404, m.members_error_not_found())
  return target
}

export type MemberUpdate = {
  name: string | null
  title: string | null
  groupId: string
  role: Role
}

// メンバーの名前・役職・グループ・ロールを変える。DB はすぐに更新し、
// 本部の Safe のオーナーの顔ぶれが変わるときは、オンチェーンの変更の提案も作る
export async function updateMember(
  db: Db,
  actor: Member,
  memberId: string,
  input: MemberUpdate,
) {
  const target = await loadTarget(db, memberId)
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, input.groupId),
  })
  if (!group) throw new MemberChangeError(400, m.members_error_group_required())
  if (!isRoleAllowedInGroup(group.kind, input.role)) {
    throw new MemberChangeError(400, m.members_error_store_viewer_only())
  }

  const assignmentChanged =
    input.groupId !== target.groupId || input.role !== target.role
  // 自分のグループやロールを変えると、Owner の権限を自分で失うことがあるため、別の Owner に任せる
  if (assignmentChanged && target.id === actor.id) {
    throw new MemberChangeError(403, m.members_error_self_demote())
  }
  if (input.role !== 'owner') await ensureAnotherOwner(db, target)

  let proposal: { id: string } | null = null
  if (assignmentChanged) {
    const hq = await getHeadquarters(db)
    const wasOwner = isHqSafeOwnerRole(target.groupId, target.role, hq)
    const willBeOwner = isHqSafeOwnerRole(input.groupId, input.role, hq)
    const signer = await getSigner(db, target)
    // パスキー未登録のメンバーには署名者がないため、提案は作らない（パスキーの登録時に加える）
    if (hq && signer && wasOwner !== willBeOwner) {
      proposal = await proposeOwnerChange(db, {
        hq,
        signer,
        direction: willBeOwner ? 'add' : 'remove',
        target,
        actor,
        linkTarget: true,
      })
    }
  }

  await db
    .update(members)
    .set({
      name: input.name,
      title: input.title,
      groupId: input.groupId,
      role: input.role,
    })
    .where(eq(members.id, target.id))

  return { proposalId: proposal?.id ?? null }
}

// メンバーを組織から外す。メンバーの行・その人の追加用リンク・ダッシュボードのユーザーを消し、
// 本部の Safe のオーナーだった場合は、オーナーから外す提案を作る
export async function removeMember(db: Db, actor: Member, memberId: string) {
  const target = await loadTarget(db, memberId)
  if (target.id === actor.id) {
    throw new MemberChangeError(403, m.members_error_self_remove())
  }
  await ensureAnotherOwner(db, target)

  // 作成・署名した提案は申請者と承認者の記録として残すため、その履歴があるメンバーの行は消せない
  const [created, signed] = await Promise.all([
    db.query.safeTransactions.findFirst({
      where: eq(safeTransactions.createdBy, target.id),
    }),
    db.query.safeTransactionSignatures.findFirst({
      where: eq(safeTransactionSignatures.memberId, target.id),
    }),
  ])
  if (created || signed) {
    throw new MemberChangeError(409, m.members_error_has_history())
  }

  let proposal: { id: string } | null = null
  const hq = await getHeadquarters(db)
  const signer = await getSigner(db, target)
  if (hq && signer && isHqSafeOwnerRole(target.groupId, target.role, hq)) {
    proposal = await proposeOwnerChange(db, {
      hq,
      signer,
      direction: 'remove',
      target,
      actor,
      linkTarget: false,
    })
  }

  // 対象のメンバーを指す記録は、説明文に名前を残したうえで紐づけだけ外す
  await db
    .update(safeTransactions)
    .set({ targetMemberId: null })
    .where(eq(safeTransactions.targetMemberId, target.id))
  await db
    .update(invitations)
    .set({ invitedBy: null })
    .where(eq(invitations.invitedBy, target.id))
  // 本人の追加用リンクと、本人宛ての未使用の招待を消す
  await db
    .delete(invitations)
    .where(
      or(
        eq(invitations.memberId, target.id),
        and(eq(invitations.email, target.email), isNull(invitations.usedAt)),
      ),
    )
  await db.delete(members).where(eq(members.id, target.id))
  // ログインしてもメンバーに紐づかないユーザーが残らないよう、Better Auth のユーザーも消す（セッションは連鎖して消える）
  if (target.userId) await db.delete(user).where(eq(user.id, target.userId))

  return { proposalId: proposal?.id ?? null }
}

// 対象のメンバーの、送信前・送信済みのオーナーの変更の件数（一覧のバッジに出す）
export async function pendingOwnerChangeCounts(db: Db) {
  const pending = await db.query.safeTransactions.findMany({
    where: and(
      eq(safeTransactions.kind, 'owner_change'),
      inArray(safeTransactions.status, ['open', 'submitted']),
    ),
  })
  const counts = new Map<string, number>()
  for (const tx of pending) {
    if (!tx.targetMemberId) continue
    counts.set(tx.targetMemberId, (counts.get(tx.targetMemberId) ?? 0) + 1)
  }
  return counts
}
