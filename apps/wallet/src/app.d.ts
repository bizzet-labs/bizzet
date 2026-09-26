import type { Db } from '@bizzet/db'

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      db: Db
      // ログインしたパスキーのクレデンシャル ID。署名つきのセッションの Cookie から読む
      passkeyId: string | null
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}
