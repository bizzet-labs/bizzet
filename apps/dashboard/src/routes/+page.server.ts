import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const passkeyCount = (await locals.db.query.passkeys.findMany()).length
  return { passkeyCount }
}
