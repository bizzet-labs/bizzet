import { redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

// ログインなしで開けるページ。値札からの支払いは客向け、招待はログインの前に使う
const PUBLIC_PATHS = ['/login', '/pay', '/invite']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

// ログインしていなければ、ログインの画面に送る。
// ページを移るたびにサーバーで確かめるよう、url.pathname に依存させる
export const load: LayoutServerLoad = ({ locals, url }) => {
  if (!isPublicPath(url.pathname) && !locals.passkeyId) redirect(303, '/login')
  return {}
}
