import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema.ts'

// ローカル開発の DB のホスト名。localtest.me はどのサブドメインも 127.0.0.1 を指す
export const LOCAL_DB_HOST = 'db.localtest.me'

// ローカル開発の接続先。compose.yaml の Postgres と同じ値
export const LOCAL_DATABASE_URL = `postgres://postgres:postgres@${LOCAL_DB_HOST}:5432/bizzet`

// ローカルでは、Neon のドライバーの HTTP を compose.yaml の neon-proxy（4444 番）へ向ける
neonConfig.fetchEndpoint = (host) =>
  host === LOCAL_DB_HOST ? `http://${host}:4444/sql` : `https://${host}/sql`

export function createDb(url: string) {
  return drizzle({ client: neon(url), schema })
}

export type Db = ReturnType<typeof createDb>
