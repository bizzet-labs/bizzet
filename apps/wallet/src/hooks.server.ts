import type { Handle } from '@sveltejs/kit'
import { db } from '$lib/server/db'
import { readSession } from '$lib/server/session'

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.db = db
  event.locals.passkeyId = readSession(event.cookies)
  return resolve(event)
}
