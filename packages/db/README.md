# @bizzet/db

ウォレットとダッシュボードが使う DB のスキーマと接続です。本番は Neon、ローカルは Docker の Postgres を使います。

```sh
pnpm db:up        # ローカルの Postgres と Neon のプロキシを起動
pnpm db:generate  # スキーマの変更からマイグレーションを作る
pnpm db:migrate   # マイグレーションを適用する
```

ローカルの接続文字列は `postgres://postgres:postgres@db.localtest.me:5432/bizzet` です。
