import { describe, expect, it } from 'vitest'
import { type Group, sortGroups } from './visibility'

// テスト用のグループ。sortGroups が読むのは kind と createdAt だけなので、他の列は省く
function group(
  kind: 'headquarters' | 'store',
  createdAt: string,
  id: string = kind,
) {
  return {
    id,
    kind,
    createdAt: new Date(createdAt),
  } as unknown as Group
}

describe('sortGroups', () => {
  it('本部を店舗より先に並べる', () => {
    const store = group('store', '2024-01-01', 'store')
    const hq = group('headquarters', '2024-06-01', 'hq')
    expect(sortGroups([store, hq]).map((g) => g.id)).toEqual(['hq', 'store'])
  })

  it('同じ種類の中では作成順に並べる', () => {
    const later = group('store', '2024-03-01', 'later')
    const earlier = group('store', '2024-01-01', 'earlier')
    expect(sortGroups([later, earlier]).map((g) => g.id)).toEqual([
      'earlier',
      'later',
    ])
  })

  it('元の配列を変更しない', () => {
    const list = [
      group('store', '2024-03-01'),
      group('headquarters', '2024-01-01'),
    ]
    const copy = [...list]
    sortGroups(list)
    expect(list).toEqual(copy)
  })
})
