import { tableFeatures } from '@tanstack/svelte-table'

// このアプリの表はどれも件数が少なく、並べ替え・絞り込み・ページ送りは使わない。
// 使わない機能を tableFeatures に含めないことで、その分のコードが読み込まれない
export const features = tableFeatures({})

export type DataTableFeatures = typeof features
