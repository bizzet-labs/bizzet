import { sepolia } from '@bizzet/contracts'
import {
  type Address,
  BaseError,
  createWalletClient,
  custom,
  type EIP1193Provider,
  UserRejectedRequestError,
  type WalletClient,
} from 'viem'
import { sepolia as sepoliaChain } from 'viem/chains'

// 客のブラウザに入っているウォレット（EIP-1193）。値札からの支払いはログインなしで、客自身のウォレットで行う
export function getInjectedProvider(): EIP1193Provider | null {
  if (typeof window === 'undefined') return null
  const { ethereum } = window as unknown as { ethereum?: EIP1193Provider }
  return ethereum ?? null
}

export type InjectedWallet = {
  client: WalletClient
  account: Address
}

// ウォレットにアカウントの利用を求め、Sepolia に切り替えてもらう。Sepolia が未登録なら追加を求める
export async function connectInjectedWallet(
  provider: EIP1193Provider,
): Promise<InjectedWallet> {
  const client = createWalletClient({
    chain: sepoliaChain,
    transport: custom(provider),
  })
  const [account] = await client.requestAddresses()
  if (!account) throw new Error('アカウントがありません')
  if ((await client.getChainId()) !== sepolia.chainId) {
    try {
      await client.switchChain({ id: sepolia.chainId })
    } catch (e) {
      if (isUserRejection(e)) throw e
      await client.addChain({ chain: sepoliaChain })
      await client.switchChain({ id: sepolia.chainId })
    }
  }
  return { client, account }
}

// 客がウォレットの画面で拒否したかを調べる
export function isUserRejection(error: unknown): boolean {
  if (error instanceof BaseError) {
    return (
      error.walk((e) => e instanceof UserRejectedRequestError) instanceof
      UserRejectedRequestError
    )
  }
  return (error as { code?: number } | null)?.code === 4001
}
