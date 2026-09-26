export { cn } from 'cn'

export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null
}

// bits-ui の部品から、children・child を受け取らない版の props を作る
export type WithoutChild<T> = T extends { child?: unknown }
  ? Omit<T, 'child'>
  : T
export type WithoutChildren<T> = T extends { children?: unknown }
  ? Omit<T, 'children'>
  : T
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>
