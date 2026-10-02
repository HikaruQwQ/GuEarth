import { describe, expect, it } from 'vitest'
import {
  beltLatRange,
  beltShiftDegrees,
  PRESSURE_BELTS,
  windBeltArrows,
  windLanes
} from './pressureWindData'

describe('beltShiftDegrees', () => {
  it('shifts north in July and south in January', () => {
    expect(beltShiftDegrees(7)).toBeGreaterThan(5)
    expect(beltShiftDegrees(1)).toBeLessThan(-5)
    expect(Math.abs(beltShiftDegrees(4))).toBeLessThan(3)
    expect(Math.abs(beltShiftDegrees(10))).toBeLessThan(3)
  })
})

describe('beltLatRange', () => {
  it('keeps ranges inside the globe and centered near the shifted position', () => {
    const equatorial = PRESSURE_BELTS.find((belt) => belt.id === 'equatorial-low')!
    const july = beltLatRange(equatorial, 7)
    expect(july.south).toBeCloseTo(beltShiftDegrees(7) - 6, 5)
    expect(july.north).toBeCloseTo(beltShiftDegrees(7) + 6, 5)
    const polar = PRESSURE_BELTS.find((belt) => belt.id === 'polar-high-n')!
    const range = beltLatRange(polar, 7)
    expect(range.north).toBeLessThanOrEqual(90)
    expect(range.south).toBeLessThan(range.north)
  })

  it('yields valid rectangle bounds for every belt in every month', () => {
    for (const belt of PRESSURE_BELTS) {
      for (let month = 1; month <= 12; month++) {
        const range = beltLatRange(belt, month)
        expect(range.south).toBeGreaterThanOrEqual(-90)
        expect(range.north).toBeLessThanOrEqual(90)
        expect(range.south).toBeLessThan(range.north)
      }
    }
  })
})

describe('windBeltArrows', () => {
  it('generates arrows for both hemispheres in each kind', () => {
    const arrows = windBeltArrows(7)
    expect(arrows.length).toBe(windLanes().length)
    for (const kind of ['trade', 'westerly', 'polar-easterly'] as const) {
      expect(arrows.filter((arrow) => arrow.kind === kind).length).toBeGreaterThanOrEqual(8)
    }
  })

  it('blows the northern trades toward the southwest and the westerlies toward the northeast', () => {
    const arrows = windBeltArrows(4)
    const trade = arrows.find((arrow) => arrow.id.startsWith('trade-n-'))!
    expect(trade.path[trade.path.length - 1][1]).toBeLessThan(trade.path[0][1])
    expect(trade.path[trade.path.length - 1][0]).toBeLessThan(trade.path[0][0])
    const westerly = arrows.find((arrow) => arrow.id.startsWith('westerly-n-'))!
    expect(westerly.path[westerly.path.length - 1][1]).toBeGreaterThan(westerly.path[0][1])
    expect(westerly.path[westerly.path.length - 1][0]).toBeGreaterThan(westerly.path[0][0])
    const polarEasterly = arrows.find((arrow) => arrow.id.startsWith('polar-easterly-n-'))!
    expect(polarEasterly.path[polarEasterly.path.length - 1][1]).toBeLessThan(polarEasterly.path[0][1])
    expect(polarEasterly.path[polarEasterly.path.length - 1][0]).toBeLessThan(polarEasterly.path[0][0])
  })

  it('shifts arrow latitudes with the season', () => {
    const january = windBeltArrows(1).find((arrow) => arrow.id.startsWith('trade-n-62'))!
    const july = windBeltArrows(7).find((arrow) => arrow.id.startsWith('trade-n-62'))!
    expect(july.path[0][1]).toBeGreaterThan(january.path[0][1])
  })
})
