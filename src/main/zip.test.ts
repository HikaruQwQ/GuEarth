import { describe, expect, it } from 'vitest'
import { unzip, zipFiles } from './zip'

describe('zip roundtrip', () => {
  it('packs and extracts entries with utf-8 names', () => {
    const packed = zipFiles([
      { name: 'doc.kml', data: Buffer.from('<kml><Document></Document></kml>', 'utf8') },
      { name: 'files/历史地图.png', data: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]) }
    ])
    const entries = unzip(packed)
    expect(entries.map((entry) => entry.name)).toEqual(['doc.kml', 'files/历史地图.png'])
    expect(entries[0].data.toString('utf8')).toBe('<kml><Document></Document></kml>')
    expect(Array.from(entries[1].data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('supports repeated and empty-safe content', () => {
    const payload = Buffer.alloc(5000, 7)
    const packed = zipFiles([{ name: 'a.bin', data: payload }])
    const entries = unzip(packed)
    expect(entries[0].data.length).toBe(5000)
    expect(entries[0].data[4999]).toBe(7)
  })

  it('rejects non-zip buffers', () => {
    expect(() => unzip(Buffer.from('not a zip at all'))).toThrow()
  })
})
