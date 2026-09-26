import { m } from '$lib/paraglide/messages.js'
import type { SyncEnsResult } from '$lib/server/ens'
import type { ProposeRolesResult } from '$lib/server/group-roles'
import {
  type ConfigureResult,
  type DeploySafeResult,
  HEADQUARTERS_MIN_OWNERS,
} from '$lib/server/group-safe'

// 設定画面の操作が失敗した理由を、画面に出す文言にする
export function configureMessage(
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

export function proposeMessage(
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

export function deployMessage(
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

export function ensMessage(
  reason: Extract<SyncEnsResult, { ok: false }>['reason'],
) {
  switch (reason) {
    case 'not_configured':
      return m.groups_ens_error_not_configured()
    case 'no_label':
      return m.groups_ens_error_no_label()
    case 'failed':
      return m.groups_ens_error_failed()
  }
}
