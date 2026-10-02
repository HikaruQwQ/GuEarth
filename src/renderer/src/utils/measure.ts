export type LonLat = [number, number]

const EARTH_RADIUS_KM = 6371

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function haversineKm(start: LonLat, end: LonLat): number {
  const dLat = toRadians(end[1] - start[1])
  const dLon = toRadians(end[0] - start[0])
  const lat1 = toRadians(start[1])
  const lat2 = toRadians(end[1])
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function pathLengthKm(points: LonLat[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i])
  }
  return total
}

export function sphericalPolygonAreaKm2(ring: LonLat[]): number {
  if (ring.length < 3) return 0
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const [lon1, lat1] = ring[i]
    const [lon2, lat2] = ring[(i + 1) % ring.length]
    sum += toRadians(lon2 - lon1) * (2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)))
  }
  return Math.abs((sum * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2)
}

export function ringCentroid(ring: LonLat[]): LonLat {
  let sumLon = 0
  let sumLat = 0
  for (const [lon, lat] of ring) {
    sumLon += lon
    sumLat += lat
  }
  return [sumLon / ring.length, sumLat / ring.length]
}

export function formatAreaKm2(areaKm2: number): string {
  if (areaKm2 >= 1_000_000) return `${(areaKm2 / 10_000).toFixed(1)} 万km²`
  if (areaKm2 >= 100) return `${Math.round(areaKm2).toLocaleString()} km²`
  return `${areaKm2.toFixed(1)} km²`
}

export function autoAnnotationName(kind: 'point' | 'line' | 'polygon', index: number): string {
  const prefix = kind === 'point' ? '标注点' : kind === 'line' ? '测距线' : '量算面'
  return `${prefix} ${index}`
}
