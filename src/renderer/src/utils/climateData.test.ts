import { describe, expect, it } from 'vitest'
import { CLIMATE_REGIONS, climateRegionAt, latitudeZoneName, pointInRing } from './climateData'

describe('pointInRing', () => {
  const square: Array<[number, number]> = [[0, 0], [10, 0], [10, 10], [0, 10]]

  it('detects interior and edge-adjacent exterior points', () => {
    expect(pointInRing(5, 5, square)).toBe(true)
    expect(pointInRing(-1, 5, square)).toBe(false)
    expect(pointInRing(11, 5, square)).toBe(false)
    expect(pointInRing(5, -1, square)).toBe(false)
  })
})

describe('CLIMATE_REGIONS', () => {
  it('covers the canonical textbook climate types', () => {
    const names = new Set(CLIMATE_REGIONS.map((region) => region.koppen))
    for (const code of ['Af', 'Aw', 'BWh', 'Csa', 'Cfa', 'Cfb', 'Dfc', 'ET', 'EF']) {
      expect(names.has(code)).toBe(true)
    }
  })

  it('keeps every ring closed with distinct consecutive points', () => {
    for (const region of CLIMATE_REGIONS) {
      expect(region.ring.length).toBeGreaterThanOrEqual(5)
      expect(region.ring[0]).not.toEqual(region.ring[region.ring.length - 1])
      for (let i = 1; i < region.ring.length; i++) {
        expect(region.ring[i]).not.toEqual(region.ring[i - 1])
      }
    }
  })
})

describe('climateRegionAt', () => {
  it('finds the Sahara and the Amazon at textbook coordinates', () => {
    expect(climateRegionAt(8, 23)?.name).toBe('撒哈拉沙漠')
    expect(climateRegionAt(-62, -3)?.name).toBe('亚马孙热带雨林')
    expect(climateRegionAt(114, -2)?.name).toBe('马来群岛热带雨林')
    expect(climateRegionAt(112, 29)?.koppen).toBe('Cfa')
    expect(climateRegionAt(-4, 50)?.koppen).toBe('Cfb')
  })

  it('returns nothing over open ocean without regions', () => {
    expect(climateRegionAt(-30, 0)).toBeUndefined()
    expect(climateRegionAt(160, 30)).toBeUndefined()
  })
})

describe('latitudeZoneName', () => {
  it('names the zonal belts by absolute latitude', () => {
    expect(latitudeZoneName(0)).toBe('赤道多雨地带')
    expect(latitudeZoneName(-25)).toBe('副热带（副热带高压带）')
    expect(latitudeZoneName(45)).toBe('温带（盛行西风带）')
    expect(latitudeZoneName(80)).toBe('寒带（极地高压带）')
  })
})
