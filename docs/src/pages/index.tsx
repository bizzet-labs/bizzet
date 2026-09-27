import { Redirect } from '@docusaurus/router'
import useBaseUrl from '@docusaurus/useBaseUrl'
import type { ReactNode } from 'react'

// トップページは置かず、ドキュメントの最初のページへ移す
export default function Home(): ReactNode {
  return <Redirect to={useBaseUrl('/docs/about')} />
}
