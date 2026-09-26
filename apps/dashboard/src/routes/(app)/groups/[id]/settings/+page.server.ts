import { eq, groups, members, passkeys } from '@bizzet/db'
import { error, fail } from '@sveltejs/kit'
import { getAddress } from 'viem'
import { env } from '$env/dynamic/private'
import { explorerAddressUrl, explorerTxUrl } from '$lib/explorer'
import { m } from '$lib/paraglide/messages.js'
import {
  checkLabel,
  getEnsSettings,
  isEnsOperatorConfigured,
  isReceivingCurrency,
  resolveGroupEns,
  type SyncEnsResult,
  syncGroupEns,
  trySyncGroupEns,
} from '$lib/server/ens'
import {
  getKeeperAddress,
  getRolesStatus,
  type ProposeRolesResult,
  proposeRolesSetup,
} from '$lib/server/group-roles'
import {
  type ConfigureResult,
  configureHeadquartersSafe,
  configureStoreSafe,
  type DeploySafeResult,
  deployGroupSafe,
  getHeadquartersCandidates,
  HEADQUARTERS_MIN_OWNERS,
  HEADQUARTERS_THRESHOLD,
  refreshDeployment,
} from '$lib/server/group-safe'
import { requireOwner, requireVisibleGroup } from '$lib/server/guards'
import { isOperatorConfigured } from '$lib/server/operator'
import { getHeadquarters } from '$lib/server/safe'
import { isHeadquartersMember } from '$lib/server/visibility'
import type { Actions, PageServerLoad } from './$types'

// 設定画面は Owner だけが開ける。見られないグループは存在も分からないよう 404 にする
async function loadGroup(locals: App.Locals, id: string) {
  const member = requireOwner(locals.member)
  const group = await requireVisibleGroup(locals.db, member, id)
  return { member, group }
}

// Safe の設定の確定と提案の作成は、本部の Owner だけが行える。
// 店舗の Owner がいても、店舗の Safe の取引は本部の2人承認で行うため
async function requireManager(locals: App.Locals, id: string) {
  const loaded = await loadGroup(locals, id)
  if (!(await isHeadquartersMember(locals.db, loaded.member))) {
    error(403, m.groups_error_hq_owner_only())
  }
  return loaded
}

// Safe のオーナーに、分かる範囲でメンバーの名前か「本部の Safe」を添える
async function labelOwners(
  locals: App.Locals,
  owners: readonly string[],
  headquartersSafe: string | null,
) {
  const signers = await locals.db
    .select({
      signer: passkeys.signer,
      email: members.email,
      name: members.name,
    })
    .from(members)
    .innerJoin(passkeys, eq(members.passkeyId, passkeys.id))
  return owners.map((owner) => {
    const address = getAddress(owner)
    if (headquartersSafe && address === getAddress(headquartersSafe)) {
      return { address, label: m.groups_owner_hq_safe() }
    }
    const match = signers.find((s) => getAddress(s.signer) === address)
    return {
      address,
      label: match ? (match.name ?? match.email) : m.groups_owner_unknown(),
    }
  })
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const { member, group } = await loadGroup(locals, params.id)
  const db = locals.db
  const [canManage, hq, deployedAt, ensSettings] = await Promise.all([
    isHeadquartersMember(db, member),
    getHeadquarters(db),
    refreshDeployment(db, group),
    getEnsSettings(db),
  ])
  const ensView = await resolveGroupEns(group, ensSettings)
  const headquartersSafe = hq?.safeAddress ? getAddress(hq.safeAddress) : null
  const deployed = deployedAt !== null

  const safe = group.safeAddress
    ? {
        address: getAddress(group.safeAddress),
        url: explorerAddressUrl(getAddress(group.safeAddress)),
        owners: await labelOwners(
          locals,
          group.safeOwners ?? [],
          headquartersSafe,
        ),
        threshold: group.safeThreshold ?? 0,
        deployed,
        // 運用者の鍵があれば、未配置の Safe をこの画面から配置できる
        canDeploy: !deployed && isOperatorConfigured(),
        // 配置日時は、画面で初めて配置を確認した時点のもの
        deployedAt: deployedAt?.toISOString() ?? null,
      }
    : null

  const candidates =
    group.kind === 'headquarters' && !group.safeAddress
      ? (await getHeadquartersCandidates(db, group)).map((c) => ({
          id: c.id,
          label: c.name ?? c.email,
          email: c.email,
          role: c.role,
          hasPasskey: c.signer !== null,
        }))
      : []

  const roles = await getRolesStatus(
    db,
    group,
    deployed,
    getKeeperAddress(env.KEEPER_ADDRESS),
  )

  return {
    pageTitle: m.groups_settings_title({ name: group.name }),
    group: { id: group.id, name: group.name, kind: group.kind },
    canManage,
    safe,
    headquartersConfigured: headquartersSafe !== null,
    candidates,
    minOwners: HEADQUARTERS_MIN_OWNERS,
    headquartersThreshold: HEADQUARTERS_THRESHOLD,
    ens: {
      // 運用者の鍵と ENS の設定がそろって、はじめて登録とレコードの書き込みができる
      configured: ensSettings !== null && isEnsOperatorConfigured(),
      hqName: ensSettings?.hqName ?? null,
      label: group.ensLabel,
      currency: group.receivingCurrency,
      status: group.ensStatus,
      txUrl: group.ensTxHash ? explorerTxUrl(group.ensTxHash) : null,
      view: ensView,
    },
    roles: roles && {
      ...roles,
      rolesUrl: explorerAddressUrl(roles.rolesAddress),
      proposal: roles.proposal && {
        ...roles.proposal,
        createdAt: roles.proposal.createdAt.toISOString(),
      },
    },
  }
}

function configureMessage(
  reason: Extract<ConfigureResult, { ok: false }>['reason'],
) {
  switch (reason) {
    case 'already_configured':
      return m.groups_error_already_configured()
    case 'headquarters_unconfigured':
      return m.groups_error_hq_unconfigured()
    case 'not_enough_owners':
      return m.groups_error_not_enough_owners({ min: HEADQUARTERS_MIN_OWNERS })
    case 'invalid_owner':
      return m.groups_error_invalid_owner()
  }
}

function proposeMessage(
  reason: Extract<ProposeRolesResult, { ok: false }>['reason'],
) {
  switch (reason) {
    case 'not_store':
      return m.groups_error_not_store()
    case 'store_unconfigured':
      return m.groups_error_store_unconfigured()
    case 'headquarters_unconfigured':
      return m.groups_error_hq_unconfigured()
    case 'keeper_unset':
      return m.groups_error_keeper_unset()
    case 'already_proposed':
      return m.groups_error_roles_proposed()
  }
}

function deployMessage(
  reason: Extract<DeploySafeResult, { ok: false }>['reason'],
) {
  switch (reason) {
    case 'unconfigured':
      return m.groups_safe_deploy_error_unconfigured()
    case 'already_deployed':
      return m.groups_safe_deploy_error_already()
    case 'operator_unset':
      return m.groups_safe_deploy_error_operator()
    case 'address_mismatch':
      return m.groups_safe_deploy_error_mismatch()
    case 'failed':
      return m.groups_safe_deploy_error_failed()
  }
}

function ensMessage(reason: Extract<SyncEnsResult, { ok: false }>['reason']) {
  switch (reason) {
    case 'not_configured':
      return m.groups_ens_error_not_configured()
    case 'no_label':
      return m.groups_ens_error_no_label()
    case 'failed':
      return m.groups_ens_error_failed()
  }
}

export const actions: Actions = {
  // ENS の名前のラベルと受取通貨を保存し、名前の登録とレコードの書き込みを行う（失敗時のやり直しも兼ねる）
  saveEns: async ({ locals, params, request }) => {
    const { group } = await requireManager(locals, params.id)
    const formData = await request.formData()
    const currency = formData.get('currency')
    if (!isReceivingCurrency(currency)) {
      return fail(400, {
        action: 'saveEns',
        message: m.common_error_invalid_input(),
      })
    }
    // 本部は本部の名前そのものを使うため、ラベルは店舗だけが持つ
    let ensLabel = group.ensLabel
    if (group.kind === 'store') {
      const raw = formData.get('label')
      const checked = await checkLabel(
        locals.db,
        typeof raw === 'string' ? raw : '',
        group.id,
      )
      if (!checked.ok) {
        return fail(400, {
          action: 'saveEns',
          message:
            checked.reason === 'label_taken'
              ? m.groups_error_label_taken()
              : m.groups_error_invalid_label(),
        })
      }
      ensLabel = checked.label
    }
    await locals.db
      .update(groups)
      .set({ ensLabel, receivingCurrency: currency })
      .where(eq(groups.id, group.id))
    const result = await syncGroupEns(locals.db, group.id)
    if (!result.ok) {
      return fail(400, {
        action: 'saveEns',
        message: ensMessage(result.reason),
      })
    }
    return { action: 'saveEns' }
  },

  // 本部の Safe の設定を確定する。オーナーは選ばれたメンバーのパスキーの署名者
  configureHeadquarters: async ({ locals, params, request }) => {
    const { group } = await requireManager(locals, params.id)
    if (group.kind !== 'headquarters') {
      return fail(400, {
        action: 'configureHeadquarters',
        message: m.common_error_invalid_input(),
      })
    }
    const ids = (await request.formData())
      .getAll('owner')
      .filter((v): v is string => typeof v === 'string')
    const result = await configureHeadquartersSafe(locals.db, group, ids)
    if (!result.ok) {
      return fail(400, {
        action: 'configureHeadquarters',
        message: configureMessage(result.reason),
      })
    }
    // Safe のアドレスが決まったので、名前のアドレスのレコードを書く
    await trySyncGroupEns(locals.db, group.id)
    return { action: 'configureHeadquarters' }
  },

  // 店舗の Safe の設定を確定する。本部の Safe だけをオーナーにする
  configureStore: async ({ locals, params }) => {
    const { group } = await requireManager(locals, params.id)
    if (group.kind !== 'store') {
      return fail(400, {
        action: 'configureStore',
        message: m.groups_error_not_store(),
      })
    }
    const result = await configureStoreSafe(locals.db, group)
    if (!result.ok) {
      return fail(400, {
        action: 'configureStore',
        message: configureMessage(result.reason),
      })
    }
    await trySyncGroupEns(locals.db, group.id)
    return { action: 'configureStore' }
  },

  // 確定した設定のまま、グループの Safe をチェーンに配置する。グループの Safe はここでだけ作る
  deploySafe: async ({ locals, params }) => {
    const { group } = await requireManager(locals, params.id)
    const result = await deployGroupSafe(locals.db, group)
    if (!result.ok) {
      return fail(400, {
        action: 'deploySafe',
        message: deployMessage(result.reason),
      })
    }
    return { action: 'deploySafe', txHash: result.txHash }
  },

  // 店舗の Safe の Roles v2 の設定を、店舗の Safe の取引として提案する
  proposeRoles: async ({ locals, params }) => {
    const { member, group } = await requireManager(locals, params.id)
    const result = await proposeRolesSetup(
      locals.db,
      group,
      getKeeperAddress(env.KEEPER_ADDRESS),
      member,
    )
    if (!result.ok) {
      return fail(400, {
        action: 'proposeRoles',
        message: proposeMessage(result.reason),
      })
    }
    return { action: 'proposeRoles', proposalId: result.id }
  },
}
