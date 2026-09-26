import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import type { RequestHandler } from './$types'

// Pimlico（バンドラーと Paymaster）への中継。API キーをブラウザに渡さないため、サーバー側で付けて送る
const PIMLICO_URL = 'https://api.pimlico.io/v2/sepolia/rpc'

// 中継する JSON-RPC のメソッド。これ以外は Pimlico に送らない
const ALLOWED_METHODS = new Set([
  'eth_chainId',
  'eth_supportedEntryPoints',
  'eth_estimateUserOperationGas',
  'eth_sendUserOperation',
  'eth_getUserOperationByHash',
  'eth_getUserOperationReceipt',
  'pm_getPaymasterStubData',
  'pm_getPaymasterData',
  'pimlico_getUserOperationGasPrice',
  'pimlico_getUserOperationStatus',
])

type JsonRpcRequest = { method?: unknown }

// 仮置き：ログインしていなくても中継する。バックエンドでセッションを持つ時点で、ログイン済みのメンバーの Safe に限る
export const POST: RequestHandler = async ({ request, fetch }) => {
  const apiKey = env.PIMLICO_API_KEY
  if (!apiKey) error(500, 'PIMLICO_API_KEY が設定されていません')

  const body = (await request.json()) as JsonRpcRequest | JsonRpcRequest[]
  const requests = Array.isArray(body) ? body : [body]
  for (const { method } of requests) {
    if (typeof method !== 'string' || !ALLOWED_METHODS.has(method)) {
      error(403, `中継できないメソッドです：${String(method)}`)
    }
  }

  const response = await fetch(`${PIMLICO_URL}?apikey=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return json(await response.json(), { status: response.status })
}
