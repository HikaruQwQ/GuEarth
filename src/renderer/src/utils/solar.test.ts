import { describe, expect, it } from 'vitest'
import {
  dayLengthHours,
  dayOfYear,
  daysInYear,
  formatUtcHours,
  noonSolarElevation,
  solarDeclination,
  subsolarPoint,
  terminatorRing
} from './solar'

describe('dayOfYear', () => {
  it('counts leap years correctly', () => {
    expect(daysInYear(2024)).toBe(366)
    expect(daysInYear(2025)).toBe(365)
    expect(dayOfYear({ year: 2024, month: 3, day: 1 })).toBe(61)
    expect(dayOfYear({ year: 2025, month: 3, day: 1 })).toBe(60)
    expect(dayOfYear({ year: 2025, month: 1, day: 1 })).toBe(1)
    expect(dayOfYear({ year: 2025, month: 12, day: 31 })).toBe(365)
  })
})

describe('solarDeclination', () => {
  it('reaches the obliquity at solstices and crosses zero at equinoxes', () => {
    const june = solarDeclination({ year: 2025, month: 6, day: 21 })
    const december = solarDeclination({ year: 2025, month: 12, day: 22 })
    const march = solarDeclination({ year: 2025, month: 3, day: 20 })
    const september = solarDeclination({ year: 2025, month: 9, day: 23 })
    expect(june).toBeGreaterThan(23)
    expect(june).toBeLessThan(23.6)
    expect(december).toBeLessThan(-23)
    expect(december).toBeGreaterThan(-23.6)
    expect(Math.abs(march)).toBeLessThan(1.5)
    expect(Math.abs(september)).toBeLessThan(1.5)
  })
})

describe('dayLengthHours', () => {
  it('gives twelve hours at the equator during equinox', () => {
    expect(dayLengthHours(0, 0)).toBeCloseTo(12, 5)
  })

  it('matches the textbook values for Beijing at the solstices', () => {
    const june = dayLengthHours(40, 23.44)
    const december = dayLengthHours(40, -23.44)
    expect(june).toBeGreaterThan(14.5)
    expect(june).toBeLessThan(15.2)
    expect(december).toBeGreaterThan(8.8)
    expect(december).toBeLessThan(9.5)
    expect(june + december).toBeCloseTo(24, 1)
  })

  it('clamps polar day and polar night', () => {
    expect(dayLengthHours(80, 23.44)).toBe(24)
    expect(dayLengthHours(80, -23.44)).toBe(0)
    expect(dayLengthHours(-80, -23.44)).toBe(24)
  })
})

describe('noonSolarElevation', () => {
  it('is ninety degrees at the subsolar latitude', () => {
    expect(noonSolarElevation(23.44, 23.44)).toBe(90)
  })

  it('drops with latitude distance from the subsolar point', () => {
    expect(noonSolarElevation(53.44, 23.44)).toBe(60)
    expect(noonSolarElevation(40, -23.44)).toBeCloseTo(26.56, 5)
  })
})

describe('subsolarPoint', () => {
  it('places the sun near the prime meridian at noon UTC on the equinox', () => {
    const point = subsolarPoint({ year: 2025, month: 3, day: 20 }, 12)
    expect(Math.abs(point.latitude)).toBeLessThan(1.5)
    expect(Math.abs(point.longitude)).toBeLessThan(5)
  })

  it('moves fifteen degrees west per hour', () => {
    const morning = subsolarPoint({ year: 2025, month: 3, day: 20 }, 0)
    const evening = subsolarPoint({ year: 2025, month: 3, day: 20 }, 12)
    expect(Math.abs(morning.longitude)).toBeGreaterThan(170)
    expect(Math.abs(evening.longitude)).toBeLessThan(5)
  })
})

describe('terminatorRing', () => {
  it('returns a closed ring of points ninety degrees from the subsolar point', () => {
    const ring = terminatorRing(23.44, 45, 10)
    expect(ring.length).toBe(36 + 1)
    expect(ring[0][0]).toBeCloseTo(ring[ring.length - 1][0], 6)
    expect(ring[0][1]).toBeCloseTo(ring[ring.length - 1][1], 6)
    const subsolar: [number, number] = [45, 23.44]
    for (const [lon, lat] of ring.slice(0, -1)) {
      const sinLat = Math.sin((lat * Math.PI) / 180)
      const cosLat = Math.cos((lat * Math.PI) / 180)
      const sinSub = Math.sin((subsolar[1] * Math.PI) / 180)
      const cosSub = Math.cos((subsolar[1] * Math.PI) / 180)
      const cosDelta = Math.cos(((lon - subsolar[0]) * Math.PI) / 180)
      const cosDistance = sinLat * sinSub + cosLat * cosSub * cosDelta
      expect(Math.abs(cosDistance)).toBeLessThan(0.001)
    }
  })

  it('degrades gracefully at the equinox when the subsolar point sits on the equator', () => {
    const ring = terminatorRing(0, 0, 30)
    expect(ring.length).toBe(12 + 1)
    for (const [lon, lat] of ring.slice(0, -1)) {
      expect(Math.abs(Math.abs(lon) - 90)).toBeLessThan(0.01)
    }
  })
})

describe('formatUtcHours', () => {
  it('formats fractional hours as clock time', () => {
    expect(formatUtcHours(0)).toBe('00:00')
    expect(formatUtcHours(12.5)).toBe('12:30')
    expect(formatUtcHours(24)).toBe('00:00')
  })
})
