// ベータ版は Sepolia だけのため、エクスプローラーはこの1つに決め打ちする
const EXPLORER_URL = 'https://sepolia.etherscan.io'

// アドレスをエクスプローラーで開く URL
export function explorerAddressUrl(address: string) {
  return `${EXPLORER_URL}/address/${address}`
}

// 取引をエクスプローラーで開く URL
export function explorerTxUrl(txHash: string) {
  return `${EXPLORER_URL}/tx/${txHash}`
}
