import { describe, expect, it } from 'vitest'
import { autoAnnotationName, formatAreaKm2, pathLengthKm, ringCentroid, sphericalPolygonAreaKm2 } from './measure'

describe('pathLengthKm', () => {
  it('computes the known Beijing to Shanghai distance', () => {
    const distance = pathLengthKm([[116.4, 39.9], [121.5, 31.2]])
    expect(distance).toBeGreaterThan(1050)
    expect(distance).toBeLessThan(1090)
  })

  it('sums multi-leg paths and is zero for a single point', () => {
    expect(pathLengthKm([[110, 30]])).toBe(0)
    const twoLegs = pathLengthKm([[0, 0], [1, 0], [1, 1]])
    expect(twoLegs).toBeCloseTo(pathLengthKm([[0, 0], [1, 0]]) + pathLengthKm([[1, 0], [1, 1]]), 6)
  })
})

describe('sphericalPolygonAreaKm2', () => {
  it('matches the spherical patch area for a ten degree square at the equator', () => {
    const area = sphericalPolygonAreaKm2([[0, 0], [10, 0], [10, 10], [0, 10]])
    const expected = 6371 ** 2 * ((10 * Math.PI) / 180) * Math.sin((10 * Math.PI) / 180)
    expect(area).toBeCloseTo(expected, 0)
  })

  it('returns the same area regardless of winding direction', () => {
    const clockwise = sphericalPolygonAreaKm2([[0, 0], [0, 10], [10, 10], [10, 0]])
    const counterClockwise = sphericalPolygonAreaKm2([[0, 0], [10, 0], [10, 10], [0, 10]])
    expect(clockwise).toBeCloseTo(counterClockwise, 3)
  })

  it('is zero for degenerate rings', () => {
    expect(sphericalPolygonAreaKm2([[0, 0], [1, 1]])).toBe(0)
    expect(sphericalPolygonAreaKm2([])).toBe(0)
  })

  it('is roughly one point two million square kilometers for a ten degree square', () => {
    const area = sphericalPolygonAreaKm2([[0, 0], [10, 0], [10, 10], [0, 10]])
    expect(area).toBeGreaterThan(1_200_000)
    expect(area).toBeLessThan(1_260_000)
  })
})

describe('ringCentroid', () => {
  it('averages the ring vertices', () => {
    expect(ringCentroid([[0, 0], [10, 0], [10, 10], [0, 10]])).toEqual([5, 5])
  })
})

describe('formatters', () => {
  it('formats areas across magnitudes', () => {
    expect(formatAreaKm2(50.24)).toBe('50.2 km²')
    expect(formatAreaKm2(12_345)).toBe('12,345 km²')
    expect(formatAreaKm2(1_400_000)).toBe('140.0 万km²')
  })

  it('names annotations by kind and index', () => {
    expect(autoAnnotationName('point', 1)).toBe('标注点 1')
    expect(autoAnnotationName('line', 2)).toBe('测距线 2')
    expect(autoAnnotationName('polygon', 3)).toBe('量算面 3')
  })
})
