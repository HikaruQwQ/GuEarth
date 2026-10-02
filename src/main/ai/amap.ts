import { createHash } from 'crypto'
import { net } from 'electron'
import { gcj02ToWgs84 } from '../geo'
import { readProviderKey } from '../keyVault'

export interface AmapPlace {
  name: string
  province: string
  city: string
  district: string
  address: string
  type: string
  longitude: number
  latitude: number
}

export interface AmapSearchResult {
  query: string
  places: AmapPlace[]
  note?: string
  error?: string
}

interface AmapPoi {
  name?: unknown
  pname?: unknown
  cityname?: unknown
  adname?: unknown
  address?: unknown
  type?: unknown
  location?: unknown
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

function toPlaces(pois: AmapPoi[]): AmapPlace[] {
  return pois.flatMap((poi) => {
    const location = typeof poi.location === 'string' ? poi.location.split(',') : []
    const longitude = Number(location[0])
    const latitude = Number(location[1])
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return []
    const [wgsLongitude, wgsLatitude] = gcj02ToWgs84(longitude, latitude)
    const text = (value: unknown): string => (typeof value === 'string' ? value : '')
    return [{
      name: text(poi.name),
      province: text(poi.pname),
      city: text(poi.cityname),
      district: text(poi.adname),
      address: text(poi.address),
      type: text(poi.type),
      longitude: roundCoordinate(wgsLongitude),
      latitude: roundCoordinate(wgsLatitude)
    }]
  })
}

function parsePois(body: unknown): AmapPoi[] {
  if (typeof body !== 'object' || body === null) return []
  const status = (body as { status?: unknown }).status
  if (status !== '1') return []
  const pois = (body as { pois?: unknown }).pois
  return Array.isArray(pois) ? pois.filter((poi): poi is AmapPoi => typeof poi === 'object' && poi !== null) : []
}

async function requestPois(url: string): Promise<AmapPoi[] | null> {
  try {
    const response = await net.fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) return null
    const pois = parsePois(await response.json())
    return pois
  } catch {
    return null
  }
}

function sortedParams(params: Record<string, string>): string {
  return Object.keys(params).sort().map((name) => `${name}=${params[name]}`).join('&')
}

function requestUrl(base: string, params: Record<string, string>, securityKey?: string): string {
  const query = Object.entries(params).map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
  if (securityKey) {
    const sig = createHash('md5').update(`${sortedParams(params)}${securityKey}`, 'utf8').digest('hex')
    query.push(`sig=${sig}`)
  }
  return `${base}?${query.join('&')}`
}

export async function searchPlaces(query: string, city?: string): Promise<AmapSearchResult> {
  const keywords = query.trim().slice(0, 90)
  if (!keywords) return { query, places: [], error: '缺少搜索关键词' }
  const key = readProviderKey('amap')
  const securityKey = readProviderKey('amap-sk')
  if (!key) {
    return {
      query,
      places: [],
      error: '未配置高德地图 Web 服务密钥：请在「图层管理 → 供应商密钥」中保存高德 API Key 与安全密钥（类型需为 Web 服务）'
    }
  }
  const v5Params: Record<string, string> = { key, keywords, page_size: '8' }
  if (city?.trim()) v5Params.region = city.trim().slice(0, 40)
  const v5Pois = await requestPois(requestUrl('https://restapi.amap.com/v5/place/text', v5Params, securityKey))
  let pois = v5Pois
  if (pois === null || pois.length === 0) {
    const v3Params: Record<string, string> = { key, keywords, offset: '8', page: '1', extensions: 'base' }
    if (city?.trim()) v3Params.city = city.trim().slice(0, 40)
    pois = await requestPois(requestUrl('https://restapi.amap.com/v3/place/text', v3Params, securityKey))
  }
  if (pois === null) return { query, places: [], error: '高德地点搜索请求失败，请检查密钥权限与安全密钥配置（需 Web 服务类型）或稍后重试' }
  const places = toPlaces(pois).slice(0, 8)
  if (places.length === 0) return { query, places: [], note: '没有找到匹配的地点，可尝试更常见的名称' }
  return { query, places }
}
