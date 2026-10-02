import { net } from 'electron'

export interface PlaceResult {
  name: string
  detail: string
  lon: number
  lat: number
  kind: string
}

export interface PeakResult {
  name: string
  lon: number
  lat: number
  elevation: number
}

export interface BoundsInput {
  west: number
  south: number
  east: number
  north: number
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const REQUEST_TIMEOUT_MS = 20000

function assertBounds(value: unknown): BoundsInput {
  if (typeof value !== 'object' || value === null) throw new Error('无效的视角范围')
  const candidate = value as Record<string, unknown>
  const west = Number(candidate.west)
  const south = Number(candidate.south)
  const east = Number(candidate.east)
  const north = Number(candidate.north)
  for (const entry of [west, south, east, north]) {
    if (!Number.isFinite(entry)) throw new Error('无效的视角范围')
  }
  if (west >= east || south >= north) throw new Error('无效的视角范围')
  return { west, south, east, north }
}

export async function searchPlaces(rawQuery: unknown): Promise<PlaceResult[]> {
  if (typeof rawQuery !== 'string') throw new Error('无效的搜索词')
  const query = rawQuery.trim()
  if (!query || query.length > 120) throw new Error('无效的搜索词')
  const url = new URL(NOMINATIM_URL)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '8')
  url.searchParams.set('accept-language', 'zh-CN')
  const response = await netFetchJson(url.toString(), {
    method: 'GET',
    headers: { 'User-Agent': 'GuEarth/0.1 (geography teaching desktop app)', 'Accept-Language': 'zh-CN' }
  })
  if (!Array.isArray(response)) throw new Error('地名检索服务返回异常')
  return response
    .filter((entry) => typeof entry === 'object' && entry !== null)
    .map((entry) => {
      const record = entry as Record<string, unknown>
      const displayName = typeof record.display_name === 'string' ? record.display_name : '未知地点'
      const parts = displayName.split(',').map((part) => part.trim())
      return {
        name: typeof record.name === 'string' && record.name ? record.name : parts[0] ?? '未知地点',
        detail: parts.slice(1).join('，') || displayName,
        lon: Number(record.lon),
        lat: Number(record.lat),
        kind: typeof record.type === 'string' ? record.type : 'place'
      }
    })
    .filter((entry) => Number.isFinite(entry.lon) && Number.isFinite(entry.lat))
}

function overpassQuery(bounds: BoundsInput): string {
  const { west, south, east, north } = bounds
  const bbox = `${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)}`
  return `[out:json][timeout:20];node["natural"="peak"](${bbox});node["natural"="volcano"](${bbox});out body 80;`
}

export async function findPeaks(rawBounds: unknown, rawMinElevation: unknown): Promise<PeakResult[]> {
  const bounds = assertBounds(rawBounds)
  const minElevation = typeof rawMinElevation === 'number' && Number.isFinite(rawMinElevation) ? rawMinElevation : 0
  const spanLon = bounds.east - bounds.west
  const spanLat = bounds.north - bounds.south
  if (spanLon > 12 || spanLat > 12) throw new Error('视角范围过大，请先缩放到具体区域再检索')
  const body = `data=${encodeURIComponent(overpassQuery(bounds))}`
  let lastError: unknown = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await netFetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'GuEarth/0.1 (geography teaching desktop app)' },
        body
      })
      return parseOverpassPeaks(response, minElevation)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('地貌检索服务不可用')
}

function parseOverpassPeaks(payload: unknown, minElevation: number): PeakResult[] {
  if (typeof payload !== 'object' || payload === null || !Array.isArray((payload as Record<string, unknown>).elements)) {
    throw new Error('地貌检索服务返回异常')
  }
  const elements = (payload as { elements: unknown[] }).elements
  const peaks: PeakResult[] = []
  for (const element of elements) {
    if (typeof element !== 'object' || element === null) continue
    const record = element as Record<string, unknown>
    const lat = Number(record.lat)
    const lon = Number(record.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const tags = typeof record.tags === 'object' && record.tags !== null ? (record.tags as Record<string, unknown>) : {}
    const elevation = Number(tags.ele)
    if (!Number.isFinite(elevation) || elevation < minElevation) continue
    const rawName = typeof tags.name === 'string' && tags.name ? tags.name : typeof tags['name:zh'] === 'string' ? tags['name:zh'] : ''
    const isVolcano = tags.natural === 'volcano'
    peaks.push({ name: rawName || (isVolcano ? '未命名火山' : '未命名山峰'), lon, lat, elevation })
  }
  peaks.sort((a, b) => b.elevation - a.elevation)
  return peaks.slice(0, 20)
}

async function netFetchJson(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<unknown> {
  const response = await net.fetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) throw new Error(`检索服务响应异常 (${response.status})`)
  return response.json()
}
