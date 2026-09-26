import { createDb, LOCAL_DATABASE_URL } from '@bizzet/db'
import { env } from '$env/dynamic/private'

// 未設定か空ならローカル開発の DB（compose.yaml）につなぐ
export const db = createDb(env.DATABASE_URL || LOCAL_DATABASE_URL)
