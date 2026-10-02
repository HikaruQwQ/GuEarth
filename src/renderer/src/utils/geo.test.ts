import { describe, expect, it } from 'vitest'
import {
  clampSelectionBounds,
  densifyLine,
  extractContours,
  monsoonWindAt,
  niceContourInterval,
  rainBandForMonth,
  terrainLevelForSpan,
  type ElevationGrid
} from './geo'

function peakGrid(): ElevationGrid {
  const cols = 21
  const rows = 21
  const values: number[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lon = 100 + col
      const lat = 40 - row
      const d = Math.hypot(lon - 110.5, lat - 29.5)
      values.push(Math.max(200, 2000 - d * 400))
    }
  }
  return { cols, rows, bounds: { west: 100, east: 120, south: 19, north: 40 }, min: Math.min(...values), max: Math.max(...values), values }
}

describe('extractContours', () => {
  it('produces closed rings around an isolated peak', () => {
    const grid = peakGrid()
    const lines = extractContours(grid, 500)
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(line.elevation).toBeGreaterThan(0)
      const first = line.points.slice(0, 2)
      const last = line.points.slice(-2)
      if (line.points.length > 8) {
        expect(Math.hypot(first[0] - last[0], first[1] - last[1])).toBeLessThan(0.2)
      }
    }
  })

  it('interpolates crossing points between grid nodes', () => {
    const grid: ElevationGrid = {
      cols: 2,
      rows: 2,
      bounds: { west: 0, east: 1, south: 0, north: 1 },
      min: 10,
      max: 90,
      values: [10, 90, 10, 90]
    }
    const lines = extractContours(grid, 50)
    expect(lines).toHaveLength(1)
    expect(lines[0].elevation).toBe(50)
    expect(lines[0].points).toHaveLength(4)
    expect(lines[0].points[0]).toBeCloseTo(0.5, 5)
  })

  it('returns empty for non-positive interval', () => {
    expect(extractContours(peakGrid(), 0)).toEqual([])
  })
})

describe('monsoonWindAt', () => {
  it('blows from the southeast toward land in July', () => {
    const [u, v] = monsoonWindAt(115, 30, 7)
    expect(u).toBeLessThan(0)
    expect(v).toBeGreaterThan(0)
  })

  it('blows from the northwest toward the sea in January', () => {
    const [u, v] = monsoonWindAt(115, 30, 1)
    expect(u).toBeGreaterThan(0)
    expect(v).toBeLessThan(0)
  })

  it('fades to calm outside the monsoon region', () => {
    const [u, v] = monsoonWindAt(0, 0, 7)
    expect(Math.abs(u)).toBeLessThan(1e-6)
    expect(Math.abs(v)).toBeLessThan(1e-6)
  })
})

describe('rainBandForMonth', () => {
  it('sits over south China in April and north China by August', () => {
    expect(rainBandForMonth(4).centerLat).toBeCloseTo(22, 5)
    expect(rainBandForMonth(8).centerLat).toBeGreaterThan(rainBandForMonth(6).centerLat)
    expect(rainBandForMonth(8).centerLat).toBeGreaterThan(35)
  })

  it('is weak in winter', () => {
    expect(rainBandForMonth(1).alpha).toBeLessThan(0.2)
    expect(rainBandForMonth(12).alpha).toBeLessThan(rainBandForMonth(8).alpha)
  })
})

describe('densifyLine', () => {
  it('spreads samples evenly along a polyline', () => {
    const points: Array<[number, number]> = [[100, 30], [102, 30], [102, 32]]
    const dense = densifyLine(points, 5)
    expect(dense).toHaveLength(5)
    expect(dense[0][0]).toBeCloseTo(100, 5)
    expect(dense[4][1]).toBeCloseTo(32, 5)
    expect(dense[2][0]).toBeCloseTo(102, 5)
  })
})

describe('niceContourInterval and levels', () => {
  it('picks a round interval near range/10', () => {
    expect(niceContourInterval(800)).toBe(100)
    expect(niceContourInterval(4500)).toBe(500)
  })

  it('maps region span to a bounded terrain level', () => {
    expect(terrainLevelForSpan(8)).toBeGreaterThanOrEqual(7)
    expect(terrainLevelForSpan(8)).toBeLessThanOrEqual(14)
    expect(terrainLevelForSpan(0.2)).toBe(14)
  })
})

describe('clampSelectionBounds', () => {
  it('clamps oversized selections to the maximum span', () => {
    const clamped = clampSelectionBounds({ west: 80, east: 140, south: 10, north: 50 })
    expect(clamped.east - clamped.west).toBeLessThanOrEqual(8)
    expect(clamped.north - clamped.south).toBeLessThanOrEqual(8)
  })

  it('keeps normal selections unchanged', () => {
    const clamped = clampSelectionBounds({ west: 100, east: 102, south: 30, north: 31 })
    expect(clamped.west).toBeCloseTo(100, 5)
    expect(clamped.north).toBeCloseTo(31, 5)
  })
})
