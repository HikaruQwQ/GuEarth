export interface GridBounds {
  west: number
  east: number
  south: number
  north: number
}

export interface ElevationGrid {
  cols: number
  rows: number
  bounds: GridBounds
  min: number
  max: number
  values: number[]
}

export interface ContourLine {
  elevation: number
  points: number[]
}

export interface RainBand {
  centerLat: number
  halfWidth: number
  west: number
  east: number
  alpha: number
}

export interface ProfileSample {
  distanceKm: number
  longitude: number
  latitude: number
  elevation: number
}

export function gridValue(grid: ElevationGrid, row: number, col: number): number {
  return grid.values[row * grid.cols + col]
}

export function gridLonAt(grid: ElevationGrid, col: number): number {
  const { west, east } = grid.bounds
  return west + ((east - west) * col) / (grid.cols - 1)
}

export function gridLatAt(grid: ElevationGrid, row: number): number {
  const { north, south } = grid.bounds
  return north - ((north - south) * row) / (grid.rows - 1)
}

const CONTOUR_STEPS = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]

export function niceContourInterval(range: number): number {
  const target = range / 10
  for (const step of CONTOUR_STEPS) {
    if (step >= target) return step
  }
  return CONTOUR_STEPS[CONTOUR_STEPS.length - 1]
}

function edgeFraction(low: number, high: number, level: number): number {
  const span = high - low
  if (Math.abs(span) < 1e-9) return 0.5
  return Math.min(1, Math.max(0, (level - low) / span))
}

function cellSegments(
  grid: ElevationGrid,
  row: number,
  col: number,
  level: number,
  out: number[][]
): void {
  const v00 = gridValue(grid, row, col)
  const v10 = gridValue(grid, row, col + 1)
  const v11 = gridValue(grid, row + 1, col + 1)
  const v01 = gridValue(grid, row + 1, col)
  const a00 = v00 > level
  const a10 = v10 > level
  const a11 = v11 > level
  const a01 = v01 > level
  if (a00 === a10 && a10 === a11 && a11 === a01) return
  const lon0 = gridLonAt(grid, col)
  const lon1 = gridLonAt(grid, col + 1)
  const lat0 = gridLatAt(grid, row)
  const lat1 = gridLatAt(grid, row + 1)
  const crossings: number[][] = []
  if (a00 !== a10) crossings.push([lon0 + edgeFraction(v00, v10, level) * (lon1 - lon0), lat0])
  if (a10 !== a11) crossings.push([lon1, lat0 + edgeFraction(v10, v11, level) * (lat1 - lat0)])
  if (a01 !== a11) crossings.push([lon0 + edgeFraction(v01, v11, level) * (lon1 - lon0), lat1])
  if (a00 !== a01) crossings.push([lon0, lat0 + edgeFraction(v00, v01, level) * (lat1 - lat0)])
  if (crossings.length === 2) {
    out.push([crossings[0][0], crossings[0][1], crossings[1][0], crossings[1][1]])
    return
  }
  if (crossings.length === 4) {
    const centerAbove = (v00 + v10 + v01 + v11) / 4 > level
    if (centerAbove === a00) {
      out.push([...crossings[0], ...crossings[1]])
      out.push([...crossings[2], ...crossings[3]])
    } else {
      out.push([...crossings[0], ...crossings[3]])
      out.push([...crossings[1], ...crossings[2]])
    }
  }
}

function pointKey(lon: number, lat: number): string {
  return `${Math.round(lon * 1e7)}_${Math.round(lat * 1e7)}`
}

function linkSegments(segments: number[][], level: number): ContourLine[] {
  const adjacency = new Map<string, Array<{ segment: number; end: 0 | 1 }>>()
  segments.forEach((segment, index) => {
    const startKey = pointKey(segment[0], segment[1])
    const endKey = pointKey(segment[2], segment[3])
    if (!adjacency.has(startKey)) adjacency.set(startKey, [])
    if (!adjacency.has(endKey)) adjacency.set(endKey, [])
    adjacency.get(startKey)!.push({ segment: index, end: 0 })
    adjacency.get(endKey)!.push({ segment: index, end: 1 })
  })
  const used = new Array(segments.length).fill(false)
  const lines: ContourLine[] = []
  const walk = (points: number[], lon: number, lat: number, forward: boolean): void => {
    for (;;) {
      const bucket = adjacency.get(pointKey(lon, lat))
      const entry = bucket?.find((candidate) => !used[candidate.segment])
      if (!entry) return
      used[entry.segment] = true
      const segment = segments[entry.segment]
      const next = entry.end === 0 ? [segment[2], segment[3]] : [segment[0], segment[1]]
      if (forward) points.push(next[0], next[1])
      else points.unshift(next[0], next[1])
      lon = next[0]
      lat = next[1]
    }
  }
  for (let index = 0; index < segments.length; index++) {
    if (used[index]) continue
    used[index] = true
    const segment = segments[index]
    const points = [segment[0], segment[1], segment[2], segment[3]]
    walk(points, segment[2], segment[3], true)
    walk(points, segment[0], segment[1], false)
    lines.push({ elevation: level, points })
  }
  return lines
}

export function extractContours(grid: ElevationGrid, interval: number): ContourLine[] {
  if (!(interval > 0) || grid.cols < 2 || grid.rows < 2) return []
  const lines: ContourLine[] = []
  const first = Math.ceil(grid.min / interval) * interval
  for (let level = first; level <= grid.max; level += interval) {
    const segments: number[][] = []
    for (let row = 0; row < grid.rows - 1; row++) {
      for (let col = 0; col < grid.cols - 1; col++) {
        cellSegments(grid, row, col, level, segments)
      }
    }
    lines.push(...linkSegments(segments, level))
  }
  return lines
}

export function densifyLine(points: Array<[number, number]>, count: number): Array<[number, number]> {
  if (points.length < 2 || count < 2) return points.slice()
  const legLengths: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const midLat = ((points[i][1] + points[i - 1][1]) / 2) * (Math.PI / 180)
    const dx = (points[i][0] - points[i - 1][0]) * Math.cos(midLat)
    const dy = points[i][1] - points[i - 1][1]
    const length = Math.hypot(dx, dy)
    legLengths.push(length)
    total += length
  }
  if (!(total > 0)) return [points[0], points[points.length - 1]]
  const result: Array<[number, number]> = []
  let legIndex = 0
  let consumed = 0
  for (let k = 0; k < count; k++) {
    const target = (total * k) / (count - 1)
    while (legIndex < legLengths.length - 1 && consumed + legLengths[legIndex] < target) {
      consumed += legLengths[legIndex]
      legIndex++
    }
    const legLength = legLengths[legIndex]
    const t = legLength > 0 ? Math.min(1, Math.max(0, (target - consumed) / legLength)) : 0
    const start = points[legIndex]
    const end = points[legIndex + 1]
    result.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t])
  }
  return result
}

export function legLengthKm(start: [number, number], end: [number, number]): number {
  const midLat = ((start[1] + end[1]) / 2) * (Math.PI / 180)
  const dLonKm = (end[0] - start[0]) * 111.32 * Math.cos(midLat)
  const dLatKm = (end[1] - start[1]) * 110.57
  return Math.hypot(dLonKm, dLatKm)
}

export function rectAreaKm2(bounds: GridBounds): number {
  const midLat = ((bounds.north + bounds.south) / 2) * (Math.PI / 180)
  const widthKm = (bounds.east - bounds.west) * 111.32 * Math.cos(midLat)
  const heightKm = (bounds.north - bounds.south) * 110.57
  return Math.abs(widthKm * heightKm)
}

export function rectSizeKm(bounds: GridBounds): { widthKm: number; heightKm: number } {
  const midLat = ((bounds.north + bounds.south) / 2) * (Math.PI / 180)
  return {
    widthKm: Math.abs((bounds.east - bounds.west) * 111.32 * Math.cos(midLat)),
    heightKm: Math.abs((bounds.north - bounds.south) * 110.57)
  }
}

export function clampSelectionBounds(raw: GridBounds): GridBounds {
  const centerLon = (raw.west + raw.east) / 2
  const centerLat = (raw.south + raw.north) / 2
  const clampSpan = (span: number): number => Math.min(8, Math.max(0.05, Math.abs(span)))
  const lonSpan = clampSpan(raw.east - raw.west)
  const latSpan = clampSpan(raw.north - raw.south)
  const west = Math.max(-179.9, centerLon - lonSpan / 2)
  const east = Math.min(179.9, centerLon + lonSpan / 2)
  const south = Math.max(-89.9, centerLat - latSpan / 2)
  const north = Math.min(89.9, centerLat + latSpan / 2)
  return { west, east, south, north }
}

export function terrainLevelForSpan(spanDegrees: number): number {
  return Math.min(14, Math.max(7, Math.round(Math.log2(360 / Math.max(spanDegrees, 0.02))) + 4))
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function band(value: number, lowOut: number, lowIn: number, highIn: number, highOut: number): number {
  return smoothstep(lowOut, lowIn, value) * (1 - smoothstep(highIn, highOut, value))
}

export function monsoonWindAt(lon: number, lat: number, month: number): [number, number] {
  const season = Math.cos(((month - 7) / 12) * Math.PI * 2)
  const summerWeight = (season + 1) / 2
  const fade = band(lon, 58, 68, 138, 150) * band(lat, -12, 0, 50, 60)
  const southWestBranch = smoothstep(112, 100, lon)
  const summerU = -0.5 + 0.85 * southWestBranch
  const summerV = 0.85 - 0.1 * southWestBranch
  const winterU = 0.6
  const winterV = -0.75 * (0.4 + 0.6 * smoothstep(10, 45, lat))
  const u = (summerU * summerWeight + winterU * (1 - summerWeight)) * fade
  const v = (summerV * summerWeight + winterV * (1 - summerWeight)) * fade
  return [u, v]
}

const RAIN_KEYS: Array<{ month: number; band: RainBand }> = [
  { month: 4, band: { centerLat: 22, halfWidth: 2.5, west: 104, east: 118, alpha: 0.45 } },
  { month: 6, band: { centerLat: 28, halfWidth: 2.5, west: 108, east: 122, alpha: 0.65 } },
  { month: 8, band: { centerLat: 37, halfWidth: 3.5, west: 110, east: 130, alpha: 0.6 } },
  { month: 9, band: { centerLat: 31, halfWidth: 3, west: 106, east: 120, alpha: 0.4 } },
  { month: 10, band: { centerLat: 23, halfWidth: 2.5, west: 102, east: 114, alpha: 0.25 } }
]

const WINTER_BAND: RainBand = { centerLat: 16, halfWidth: 3, west: 108, east: 124, alpha: 0.12 }

function lerpBand(a: RainBand, b: RainBand, t: number): RainBand {
  const mix = (x: number, y: number): number => x + (y - x) * t
  return {
    centerLat: mix(a.centerLat, b.centerLat),
    halfWidth: mix(a.halfWidth, b.halfWidth),
    west: mix(a.west, b.west),
    east: mix(a.east, b.east),
    alpha: mix(a.alpha, b.alpha)
  }
}

export function rainBandForMonth(month: number): RainBand {
  const m = ((((month - 1) % 12) + 12) % 12) + 1
  const first = RAIN_KEYS[0]
  const last = RAIN_KEYS[RAIN_KEYS.length - 1]
  if (m < first.month) return { ...WINTER_BAND }
  for (let i = 0; i < RAIN_KEYS.length - 1; i++) {
    const a = RAIN_KEYS[i]
    const b = RAIN_KEYS[i + 1]
    if (m >= a.month && m <= b.month) return lerpBand(a.band, b.band, (m - a.month) / (b.month - a.month))
  }
  if (m === last.month) return { ...last.band }
  return lerpBand(last.band, WINTER_BAND, Math.min(1, (m - last.month) / 3))
}

export function rainBandRing(band: RainBand): number[] {
  const { centerLat, halfWidth, west, east } = band
  const midLon = (west + east) / 2
  return [
    west, centerLat - halfWidth,
    midLon, centerLat - halfWidth - 1,
    east, centerLat - halfWidth,
    east, centerLat + halfWidth,
    midLon, centerLat + halfWidth + 1,
    west, centerLat + halfWidth
  ]
}

export const HYPSOMETRIC_STOPS: Array<[number, string]> = [
  [0, '#38689b'],
  [0.06, '#4b8f5e'],
  [0.24, '#7cb26a'],
  [0.4, '#d8cd7a'],
  [0.55, '#c99a55'],
  [0.72, '#a96f42'],
  [0.88, '#8a5a3b'],
  [1, '#f2eee9']
]

export function monthLabel(month: number): string {
  return `${month}月`
}

export function formatKm(value: number): string {
  if (value >= 100) return `${value.toFixed(0)} km`
  if (value >= 1) return `${value.toFixed(1)} km`
  return `${(value * 1000).toFixed(0)} m`
}

export function formatElevation(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} m`
}
