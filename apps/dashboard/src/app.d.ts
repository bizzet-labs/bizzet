import type { Db } from '@bizzet/db'
import type { Member } from '$lib/server/auth'

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      db: Db
      member: Member | null
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}
