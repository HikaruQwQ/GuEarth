import { describe, expect, it } from 'vitest'
import { contoursToGeoJson, profileToCsv } from './vectorFiles'

describe('contoursToGeoJson', () => {
  it('builds a FeatureCollection of LineStrings with elevation', () => {
    const geojson = JSON.parse(contoursToGeoJson([{ elevation: 500, points: [116, 39, 117, 40] }]))
    expect(geojson.type).toBe('FeatureCollection')
    expect(geojson.features[0].properties.elevation).toBe(500)
    expect(geojson.features[0].geometry.coordinates).toEqual([[116, 39], [117, 40]])
  })
})

describe('profileToCsv', () => {
  it('writes distance, position and elevation rows', () => {
    const csv = profileToCsv([
      { distanceKm: 0, longitude: 116, latitude: 39, elevation: 120.4 },
      { distanceKm: 1.23456, longitude: 116.1, latitude: 39.1, elevation: 300 }
    ])
    expect(csv.split('\n')[0]).toBe('distance_km,longitude,latitude,elevation_m')
    expect(csv.split('\n')[1]).toBe('0.0000,116.000000,39.000000,120')
    expect(csv.split('\n')[2]).toBe('1.2346,116.100000,39.100000,300')
  })
})
