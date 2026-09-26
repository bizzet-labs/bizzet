import { defineConfig } from 'drizzle-kit'

// マイグレーションは Postgres に直接つなぐ。未設定ならローカル開発の DB（compose.yaml）を使う
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/bizzet',
  },
})
