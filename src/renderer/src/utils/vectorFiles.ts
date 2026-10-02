import type { ContourLine, ProfileSample } from './geo'

export function contoursToGeoJson(lines: ContourLine[]): string {
  const features = lines.map((line) => {
    const coordinates: number[][] = []
    for (let i = 0; i < line.points.length; i += 2) {
      coordinates.push([Number(line.points[i].toFixed(6)), Number(line.points[i + 1].toFixed(6))])
    }
    return {
      type: 'Feature',
      properties: { elevation: Math.round(line.elevation) },
      geometry: { type: 'LineString', coordinates }
    }
  })
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2)
}

export function profileToCsv(samples: ProfileSample[]): string {
  const rows = ['distance_km,longitude,latitude,elevation_m']
  for (const sample of samples) {
    rows.push([sample.distanceKm.toFixed(4), sample.longitude.toFixed(6), sample.latitude.toFixed(6), Math.round(sample.elevation)].join(','))
  }
  return rows.join('\n')
}
