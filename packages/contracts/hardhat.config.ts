import hardhatToolboxViemPlugin from '@nomicfoundation/hardhat-toolbox-viem'
import { configVariable, defineConfig } from 'hardhat/config'

// ウォレットの範囲に Bizzet が書くコントラクトはなく、監査済みの配置済みコントラクトを使う。
// そのため solidity の設定は持たず、Sepolia の fork と実ネットワークだけを定義する。
export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  networks: {
    sepoliaFork: {
      type: 'edr-simulated',
      chainType: 'l1',
      forking: {
        url: configVariable('SEPOLIA_RPC_URL'),
      },
    },
    sepolia: {
      type: 'http',
      chainType: 'l1',
      url: configVariable('SEPOLIA_RPC_URL'),
      accounts: [configVariable('SEPOLIA_PRIVATE_KEY')],
    },
  },
})
