export interface PressureBelt {
  id: string
  name: string
  kind: 'low' | 'high'
  centerLat: number
  halfWidth: number
  labelLon: number
}

export const PRESSURE_BELTS: PressureBelt[] = [
  { id: 'polar-high-n', name: '极地高压带', kind: 'high', centerLat: 86, halfWidth: 5, labelLon: 100 },
  { id: 'subpolar-low-n', name: '副极地低压带', kind: 'low', centerLat: 62, halfWidth: 5, labelLon: 100 },
  { id: 'subtropical-high-n', name: '副热带高压带', kind: 'high', centerLat: 32, halfWidth: 6, labelLon: 150 },
  { id: 'equatorial-low', name: '赤道低压带', kind: 'low', centerLat: 0, halfWidth: 6, labelLon: 100 },
  { id: 'subtropical-high-s', name: '副热带高压带', kind: 'high', centerLat: -32, halfWidth: 6, labelLon: 20 },
  { id: 'subpolar-low-s', name: '副极地低压带', kind: 'low', centerLat: -62, halfWidth: 5, labelLon: -40 },
  { id: 'polar-high-s', name: '极地高压带', kind: 'high', centerLat: -86, halfWidth: 5, labelLon: -40 }
]

export interface WindLane {
  id: string
  kind: 'trade' | 'westerly' | 'polar-easterly'
  lon: number
  anchorLat: number
}

const WIND_LONLANES = [62, 104, 146, -40]

export function beltShiftDegrees(monthPhase: number): number {
  return 6 * Math.sin((2 * Math.PI * (monthPhase - 3.5)) / 12)
}

export function beltLatRange(belt: PressureBelt, monthPhase: number): { south: number; north: number } {
  const shift = beltShiftDegrees(monthPhase)
  const center = Math.min(90, Math.max(-90, belt.centerLat + shift))
  const south = Math.min(90, Math.max(-90, center - belt.halfWidth))
  const north = Math.min(90, Math.max(-90, center + belt.halfWidth))
  return { south, north }
}

export function windLanes(): WindLane[] {
  const lanes: WindLane[] = []
  for (const lon of WIND_LONLANES) {
    lanes.push({ id: `polar-easterly-n-${lon}`, kind: 'polar-easterly', lon, anchorLat: 84 })
    lanes.push({ id: `westerly-n-${lon}`, kind: 'westerly', lon, anchorLat: 38 })
    lanes.push({ id: `trade-n-${lon}`, kind: 'trade', lon, anchorLat: 18 })
    lanes.push({ id: `trade-s-${lon}`, kind: 'trade', lon, anchorLat: -18 })
    lanes.push({ id: `westerly-s-${lon}`, kind: 'westerly', lon, anchorLat: -38 })
    lanes.push({ id: `polar-easterly-s-${lon}`, kind: 'polar-easterly', lon, anchorLat: -84 })
  }
  return lanes
}

export interface WindArrowPath {
  id: string
  kind: WindLane['kind']
  path: Array<[number, number]>
}

function arrowPath(lane: WindLane, shift: number): Array<[number, number]> {
  const lat = lane.anchorLat + shift
  switch (lane.kind) {
    case 'trade':
      return lane.anchorLat > 0
        ? [[lane.lon, lat], [lane.lon - 4, lat - 5], [lane.lon - 9, lat - 10]]
        : [[lane.lon, lat], [lane.lon - 4, lat + 5], [lane.lon - 9, lat + 10]]
    case 'westerly':
      return lane.anchorLat > 0
        ? [[lane.lon, lat], [lane.lon + 5, lat + 6], [lane.lon + 11, lat + 13]]
        : [[lane.lon, lat], [lane.lon + 5, lat - 6], [lane.lon + 11, lat - 13]]
    case 'polar-easterly':
      return lane.anchorLat > 0
        ? [[lane.lon, lat], [lane.lon - 4, lat - 7], [lane.lon - 9, lat - 15]]
        : [[lane.lon, lat], [lane.lon - 4, lat + 7], [lane.lon - 9, lat + 15]]
  }
}

export function windBeltArrows(monthPhase: number): WindArrowPath[] {
  const shift = beltShiftDegrees(monthPhase)
  return windLanes().map((lane) => ({
    id: lane.id,
    kind: lane.kind,
    path: arrowPath(lane, shift).map(([lon, lat]) => [lon, Math.min(88, Math.max(-88, lat))] as [number, number])
  }))
}

export const WIND_KIND_LABELS: Record<WindLane['kind'], string> = {
  trade: '信风带（东北 / 东南信风）',
  westerly: '盛行西风带（西南 / 西北风）',
  'polar-easterly': '极地东风带'
}

export const WIND_KIND_COLORS: Record<WindLane['kind'], string> = {
  trade: '#fa8c16',
  westerly: '#2f54eb',
  'polar-easterly': '#13c2c2'
}

export const BELT_COLORS: Record<PressureBelt['kind'], string> = {
  low: '#1677ff',
  high: '#f5222d'
}
