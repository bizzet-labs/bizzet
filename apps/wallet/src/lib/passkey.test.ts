import { describe, expect, it } from 'vitest'
import { toCoordinates } from './passkey'

describe('toCoordinates', () => {
  it('64バイトの公開鍵を、前半32バイトの x と後半32バイトの y に分ける', () => {
    const x = 1n
    const y = 2n
    const publicKey = `0x${x.toString(16).padStart(64, '0')}${y
      .toString(16)
      .padStart(64, '0')}` as const

    expect(toCoordinates(publicKey)).toEqual({ x, y })
  })

  it('x・y ともに 256 ビットいっぱいの値を扱える', () => {
    const max = (1n << 256n) - 1n
    const publicKey = `0x${max.toString(16)}${max.toString(16)}` as const

    expect(toCoordinates(publicKey)).toEqual({ x: max, y: max })
  })
})
