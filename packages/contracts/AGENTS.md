# @bizzet/contracts

ウォレットのオンチェーン側（Safe・パスキー署名者・Safe4337Module・Zodiac Roles v2）を Sepolia で扱うパッケージ。設計は `docs/docs/design-wallet.mdx` を正とする。

## Project layout

```
src/              アドレスと calldata のヘルパー（apps から import する）
  addresses/      チェーンごとの配置済みアドレス（Sepolia のみ）
test/             Sepolia fork 上の統合テスト（node:test + viem）
hardhat.config.ts ネットワークは sepoliaFork と sepolia のみ
```

## Rules

- Bizzet は Solidity を書かない。監査済みの配置をそのまま使うため、`contracts/` は置かない
- アドレスは公式の配置一覧で確かめたものだけを `src/addresses/` に書き、`test/sepolia-fork.ts` でコードの有無を確かめる
- `SEPOLIA_RPC_URL`・`SEPOLIA_PRIVATE_KEY` は `hardhat keystore` か環境変数で渡し、コミットしない

## Working in this project

When writing or modifying tests, configuring `hardhat.config.ts`, or interacting with the network from TypeScript, invoke the **`hardhat`** skill. The skill itself points to the matching `hardhat-toolbox-viem` skill for toolbox-specific guidance.

## Docs

- Hardhat 3 — https://hardhat.org/llms.txt
- viem — https://viem.sh/llms.txt
