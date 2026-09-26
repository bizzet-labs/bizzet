import { isDemoMode, resolveDemoName } from '$lib/server/demo'
import type { PageServerLoad } from './$types'

// デモモードでは ENS の代わりに DB から名前を解決して渡す。通常は画面が ENS で解決する
export const load: PageServerLoad = async ({ locals, params }) => {
  if (!isDemoMode()) return { demoResolution: null }
  const resolution = await resolveDemoName(locals.db, params.name)
  return {
    demoResolution: resolution
      ? {
          name: resolution.name,
          address: resolution.address,
          currency: resolution.currency,
          description: resolution.description,
        }
      : null,
  }
}
