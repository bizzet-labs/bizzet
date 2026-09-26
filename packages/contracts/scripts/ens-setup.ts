// 本部の名前の初期セットアップ（1回だけ実行する）。
// 使い方：ENS_OPERATOR_PRIVATE_KEY=0x... SEPOLIA_RPC_URL=https://... pnpm --filter @bizzet/contracts ens:setup
// ENS_HQ_LABEL（既定は bizzet）、ENS_HQ_SAFE_ADDRESS・ENS_HQ_DESCRIPTION（本部のレコード）は任意。
// 出力の JSON を、ダッシュボードの ENS の設定（ens_settings）に保存する
import { createWalletClient, getAddress, type Hex, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import {
  createSepoliaPublicClient,
  DEFAULT_SEPOLIA_RPC_URL,
} from '../src/chain.ts'
import { setupHeadquartersName, writeGroupRecords } from '../src/ens.ts'

const privateKey = process.env.ENS_OPERATOR_PRIVATE_KEY as Hex | undefined
if (!privateKey) {
  throw new Error('ENS_OPERATOR_PRIVATE_KEY を設定してください')
}
const rpcUrl = process.env.SEPOLIA_RPC_URL
const hqLabel = process.env.ENS_HQ_LABEL || 'bizzet'
const hqSafe = process.env.ENS_HQ_SAFE_ADDRESS
const hqDescription = process.env.ENS_HQ_DESCRIPTION || hqLabel

const account = privateKeyToAccount(privateKey)
const publicClient = createSepoliaPublicClient(rpcUrl)
const wallet = createWalletClient({
  account,
  chain: sepolia,
  transport: http(rpcUrl || DEFAULT_SEPOLIA_RPC_URL),
})

console.error(`運用者の鍵: ${account.address}`)
const setup = await setupHeadquartersName(
  wallet,
  publicClient,
  hqLabel,
  async (seconds) => {
    console.error(`予約の成立を ${seconds} 秒待ちます`)
    await new Promise((resolve) => setTimeout(resolve, Number(seconds) * 1000))
  },
)

// 手順6：本部の名前のレコード。Safe が未設定なら、アドレスのレコードは書かない
const recordsTxHash = await writeGroupRecords(
  wallet,
  publicClient,
  setup.resolver,
  {
    name: setup.hqName,
    address: hqSafe ? getAddress(hqSafe) : null,
    currency: 'JPYC',
    description: hqDescription,
  },
)

console.log(
  JSON.stringify(
    {
      operator: account.address,
      hqName: setup.hqName,
      subregistry: setup.subregistry,
      resolver: setup.resolver,
      expiry: setup.expiry.toString(),
      registerTxHash: setup.registerTxHash,
      recordsTxHash,
    },
    null,
    2,
  ),
)
