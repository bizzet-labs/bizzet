import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { network } from 'hardhat'
import { getAddress } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import {
  ensV2,
  OPERATOR_REGISTRY_ROLES,
  OPERATOR_RESOLVER_ROLES,
  permissionedRegistryAbi,
  permissionedResolverAbi,
  registerStoreName,
  resolveGroupName,
  setupHeadquartersName,
  writeGroupRecords,
} from '../src/ens.ts'

// 本部の名前の初期セットアップと店舗のサブネームの登録を fork 上で実行し、
// Universal Resolver で受取先・受取通貨・表示名を読めることを確かめる
describe('ENSv2 の名前', async () => {
  const { viem, networkHelpers } = await network.create({
    network: 'sepoliaFork',
  })
  const publicClient = await viem.getPublicClient()
  const [operator] = await viem.getWalletClients()

  // 他と重ならない本部のラベル（小文字・数字のみ）
  const hqLabel = `bizzet-test-${Date.now().toString(36)}`
  const hqSafe = privateKeyToAccount(generatePrivateKey()).address
  const storeSafe = privateKeyToAccount(generatePrivateKey()).address

  const setup = await setupHeadquartersName(
    operator,
    publicClient,
    hqLabel,
    async (seconds) => {
      await networkHelpers.time.increase(seconds)
    },
  )

  it('本部の名前を登録し、運用者の鍵にロールを与えている', async () => {
    assert.equal(setup.hqName, `${hqLabel}.eth`)
    assert.ok(setup.registerTxHash)
    const owner = await publicClient.readContract({
      address: ensV2.ethRegistry,
      abi: permissionedRegistryAbi,
      functionName: 'findOwner',
      args: [hqLabel],
    })
    assert.equal(getAddress(owner), getAddress(operator.account.address))
    assert.ok(
      await publicClient.readContract({
        address: setup.subregistry,
        abi: permissionedRegistryAbi,
        functionName: 'hasRootRoles',
        args: [OPERATOR_REGISTRY_ROLES, operator.account.address],
      }),
    )
    assert.ok(
      await publicClient.readContract({
        address: setup.resolver,
        abi: permissionedResolverAbi,
        functionName: 'hasRootRoles',
        args: [OPERATOR_RESOLVER_ROLES, operator.account.address],
      }),
    )
  })

  it('もう一度実行しても、登録済みの設定を返す', async () => {
    const again = await setupHeadquartersName(
      operator,
      publicClient,
      hqLabel,
      async () => {
        throw new Error('登録済みなら予約しない')
      },
    )
    assert.equal(again.registerTxHash, null)
    assert.equal(again.subregistry, setup.subregistry)
    assert.equal(again.resolver, setup.resolver)
    assert.equal(again.expiry, setup.expiry)
  })

  it('本部の名前のレコードを Universal Resolver で読める', async () => {
    await writeGroupRecords(operator, publicClient, setup.resolver, {
      name: setup.hqName,
      address: hqSafe,
      currency: 'JPYC',
      description: 'bizzet 本部',
    })
    const resolved = await resolveGroupName(publicClient, setup.hqName)
    assert.deepEqual(resolved, {
      name: setup.hqName,
      address: getAddress(hqSafe),
      currency: 'JPYC',
      description: 'bizzet 本部',
    })
  })

  it('店舗のサブネームを登録し、レコードを Universal Resolver で読める', async () => {
    const result = await registerStoreName(operator, publicClient, {
      subregistry: setup.subregistry,
      resolver: setup.resolver,
      expiry: setup.expiry,
      label: 'shibuya',
      hqName: setup.hqName,
      records: { address: storeSafe, currency: 'USDC', description: '渋谷店' },
    })
    assert.equal(result.name, `shibuya.${hqLabel}.eth`)
    assert.ok(result.registerTxHash)
    const resolved = await resolveGroupName(publicClient, result.name)
    assert.deepEqual(resolved, {
      name: result.name,
      address: getAddress(storeSafe),
      currency: 'USDC',
      description: '渋谷店',
    })

    // 受取通貨を変えると、登録は飛ばしてレコードだけを書き換える
    const retry = await registerStoreName(operator, publicClient, {
      subregistry: setup.subregistry,
      resolver: setup.resolver,
      expiry: setup.expiry,
      label: 'shibuya',
      hqName: setup.hqName,
      records: { address: storeSafe, currency: 'JPYC', description: '渋谷店' },
    })
    assert.equal(retry.registerTxHash, null)
    assert.equal(
      (await resolveGroupName(publicClient, result.name)).currency,
      'JPYC',
    )
  })

  it('登録していない名前は null を返す', async () => {
    const resolved = await resolveGroupName(
      publicClient,
      `nobody.${setup.hqName}`,
    )
    assert.equal(resolved.address, null)
    assert.equal(resolved.currency, null)
  })
})
