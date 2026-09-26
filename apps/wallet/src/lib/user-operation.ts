import { sepolia as addresses } from '@bizzet/contracts'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { type Call, http } from 'viem'
import { createBundlerClient } from 'viem/account-abstraction'
import { publicClient } from './chain.js'
import type { StoredPasskey } from './passkey.js'
import { toPasskeySafeAccount } from './safe.js'

// バンドラーと Paymaster は、SvelteKit のサーバーの中継を通して Pimlico を呼ぶ
function bundlerTransport() {
  return http(`${location.origin}/api/bundler`)
}

// パスキーで署名した取引を送り、ブロックに入るまで待つ。Safe が未作成なら、この取引で作る。
// ガス代は Paymaster が肩代わりする
export async function sendPasskeyTransaction(
  passkey: StoredPasskey,
  calls: readonly Call[],
) {
  const pimlico = createPimlicoClient({
    transport: bundlerTransport(),
    entryPoint: { address: addresses.safe4337.entryPoint, version: '0.7' },
  })
  const bundler = createBundlerClient({
    client: publicClient,
    account: await toPasskeySafeAccount(passkey),
    transport: bundlerTransport(),
    paymaster: pimlico,
    userOperation: {
      async estimateFeesPerGas() {
        return (await pimlico.getUserOperationGasPrice()).fast
      },
    },
  })
  const hash = await bundler.sendUserOperation({ calls })
  const receipt = await bundler.waitForUserOperationReceipt({ hash })
  if (!receipt.success) throw new Error('取引が失敗しました')
  return receipt.receipt.transactionHash
}
