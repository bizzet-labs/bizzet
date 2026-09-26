import { goto } from '$app/navigation'
import type { StoredPasskey } from './passkey.js'

// ウォレットのサーバーの API を呼ぶ。メンバーはサーバーがセッションの Cookie から決めるため、
// passkey は呼び出し側との互換のために受け取るだけで送らない
export async function callApi<T>(
  path: string,
  _passkey: StoredPasskey | null,
  body: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  // セッションが切れていれば、ログインし直してもらう
  if (response.status === 401) {
    await goto('/login')
  }
  if (!response.ok) {
    const message = await response
      .json()
      .then((b: { message?: string }) => b.message)
      .catch(() => undefined)
    throw new Error(message || `リクエストに失敗しました（${response.status}）`)
  }
  return (await response.json()) as T
}
