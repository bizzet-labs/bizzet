import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { network } from 'hardhat'
import {
  type Address,
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  type Hex,
  keccak256,
  parseAbi,
  zeroAddress,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { sepolia } from '../src/addresses/sepolia.ts'
import {
  encodeRolesSetup,
  rolesAbi,
  SWEEP_ROLE_KEY,
  safeModuleAbi,
} from '../src/roles.ts'
import { encodeCreateSafe, predictSafeAddress } from '../src/safe.ts'
import {
  encodeErc20Transfer,
  erc20Abi,
  hashSafeTransaction,
  safeOwnerAbi,
} from '../src/safe-transaction.ts'

// 店舗の Safe の最初の取引（Roles v2 の配置・キーパーの権限・モジュールの有効化）を fork 上で実行し、
// キーパーが本部の Safe への JPYC・USDC の送金だけを行えることを確かめる
describe('店舗の Safe の Roles v2', async () => {
  const { viem, networkHelpers } = await network.create({
    network: 'sepoliaFork',
  })
  const publicClient = await viem.getPublicClient()
  const [executor, keeper, stranger] = await viem.getWalletClients()

  // Safe のオーナーは、生の ECDSA 署名（v = 27/28）を作れるローカルの鍵にする
  const ownerA = privateKeyToAccount(generatePrivateKey())
  const ownerB = privateKeyToAccount(generatePrivateKey())
  // 本部の Safe の代わり。宛先として比べるだけのため、コードのないアドレスで足りる
  const headquarters = privateKeyToAccount(generatePrivateKey()).address
  const other = privateKeyToAccount(generatePrivateKey()).address

  // ERC-20 の残高の mapping のスロット。fork 上で balanceOf を debug_traceCall して読んだ SLOAD から求めた
  //（JPYC は FiatTokenV1 の balances、USDC は FiatTokenV2_2 の balanceAndBlacklistStates）
  const balanceSlots = {
    [sepolia.tokens.jpyc]: 516n,
    [sepolia.tokens.usdc]: 9n,
  }

  // Safe に残高を直接書き込む。実装が変わってスロットがずれたら、balanceOf の確認で気づける
  async function fund(
    token: keyof typeof balanceSlots,
    holder: Address,
    amount: bigint,
  ) {
    const key = keccak256(
      encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }],
        [holder, balanceSlots[token]],
      ),
    )
    await networkHelpers.setStorageAt(token, key, amount)
    assert.equal(
      await balanceOf(token, holder),
      amount,
      `${token} の残高を入れられない`,
    )
  }

  const balanceOf = (token: Address, holder: Address) =>
    publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [holder],
    })

  // キーパーとして Roles を通して呼ぶ。shouldRevert を true にし、許されない呼び出しは revert させる
  function execWithRole(
    roles: Address,
    to: Address,
    data: Hex,
    from = keeper,
    operation: 0 | 1 = 0,
  ) {
    return from.writeContract({
      address: roles,
      abi: rolesAbi,
      functionName: 'execTransactionWithRole',
      args: [to, 0n, data, operation, SWEEP_ROLE_KEY, true],
    })
  }

  it('キーパーは本部の Safe への送金だけを行える', async () => {
    const setup = {
      owners: [ownerA.address, ownerB.address],
      threshold: 2n,
      kind: 'group' as const,
    }
    const saltNonce = BigInt(Date.now())
    await publicClient.waitForTransactionReceipt({
      hash: await executor.sendTransaction({
        to: sepolia.safe.proxyFactory,
        data: encodeCreateSafe(setup, saltNonce),
      }),
    })
    const proxyCreationCode = await publicClient.readContract({
      address: sepolia.safe.proxyFactory,
      abi: parseAbi(['function proxyCreationCode() pure returns (bytes)']),
      functionName: 'proxyCreationCode',
    })
    const safe = predictSafeAddress(setup, saltNonce, proxyCreationCode)

    const tokens = [sepolia.tokens.jpyc, sepolia.tokens.usdc] as const
    const rolesSetup = encodeRolesSetup({
      safe,
      keeper: keeper.account.address,
      recipient: headquarters,
      tokens,
    })

    // 2人のオーナーが SafeTx のハッシュに署名し、アドレスの昇順に並べて渡す
    const safeTxHash = hashSafeTransaction(safe, {
      to: rolesSetup.to,
      value: rolesSetup.value,
      data: rolesSetup.data,
      operation: rolesSetup.operation,
      nonce: 0n,
    })
    const signers = [ownerA, ownerB].sort((a, b) =>
      a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1,
    )
    const signatures = concatHex(
      await Promise.all(signers.map((s) => s.sign({ hash: safeTxHash }))),
    )
    await publicClient.waitForTransactionReceipt({
      hash: await executor.writeContract({
        address: safe,
        abi: safeOwnerAbi,
        functionName: 'execTransaction',
        args: [
          rolesSetup.to,
          rolesSetup.value,
          rolesSetup.data,
          rolesSetup.operation,
          0n,
          0n,
          0n,
          zeroAddress,
          zeroAddress,
          signatures,
        ],
      }),
    })

    // execTransaction は内側の失敗を revert せず ExecutionFailure で返すため、結果を状態から確かめる
    const roles = rolesSetup.roles
    assert.equal(
      await publicClient.readContract({
        address: safe,
        abi: safeModuleAbi,
        functionName: 'isModuleEnabled',
        args: [roles],
      }),
      true,
      'Roles がモジュールとして有効になっていない',
    )
    for (const fn of ['owner', 'avatar', 'target'] as const) {
      assert.equal(
        getAddress(
          await publicClient.readContract({
            address: roles,
            abi: rolesAbi,
            functionName: fn,
          }),
        ),
        getAddress(safe),
        `Roles の ${fn} が店舗の Safe になっていない`,
      )
    }

    const amounts = {
      [sepolia.tokens.jpyc]: 1_000n * 10n ** 18n,
      [sepolia.tokens.usdc]: 1_000n * 10n ** 6n,
    }
    for (const token of tokens) {
      await fund(token, safe, amounts[token])
    }

    // 許すもの：本部の Safe への JPYC・USDC の送金
    for (const token of tokens) {
      const amount = amounts[token] / 4n
      await publicClient.waitForTransactionReceipt({
        hash: await execWithRole(
          roles,
          token,
          encodeErc20Transfer(headquarters, amount),
        ),
      })
      assert.equal(await balanceOf(token, headquarters), amount)
    }

    // 許さないもの：ほかの宛先・ほかの関数・ほかのコントラクト・delegatecall・ロールのない呼び出し元
    const usdc = sepolia.tokens.usdc
    const rejected: [string, () => Promise<unknown>][] = [
      [
        'ほかの宛先への送金',
        () => execWithRole(roles, usdc, encodeErc20Transfer(other, 1n)),
      ],
      [
        'approve',
        () =>
          execWithRole(
            roles,
            usdc,
            encodeFunctionData({
              abi: parseAbi(['function approve(address, uint256)']),
              functionName: 'approve',
              args: [headquarters, 1n],
            }),
          ),
      ],
      [
        'Safe 自身の呼び出し',
        () =>
          execWithRole(
            roles,
            safe,
            encodeFunctionData({
              abi: safeModuleAbi,
              functionName: 'enableModule',
              args: [other],
            }),
          ),
      ],
      [
        'delegatecall',
        () =>
          execWithRole(
            roles,
            usdc,
            encodeErc20Transfer(headquarters, 1n),
            keeper,
            1,
          ),
      ],
      [
        'ロールのない呼び出し元',
        () =>
          execWithRole(
            roles,
            usdc,
            encodeErc20Transfer(headquarters, 1n),
            stranger,
          ),
      ],
    ]
    for (const [name, call] of rejected) {
      await assert.rejects(call, `${name} が拒まれていない`)
    }
    assert.equal(await balanceOf(usdc, other), 0n)
    assert.equal(
      await balanceOf(usdc, headquarters),
      amounts[usdc] / 4n,
      '拒まれた呼び出しで本部の残高が変わった',
    )
  })
})
