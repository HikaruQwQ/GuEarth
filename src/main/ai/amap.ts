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

function parsePois(body: unknown): { pois: AmapPoi[]; error?: string } {
  if (typeof body !== 'object' || body === null) return { pois: [], error: '高德返回了无效响应' }
  const result = body as { status?: unknown; info?: unknown; infocode?: unknown; pois?: unknown }
  if (result.status !== '1') {
    if (result.infocode === '10009') return { pois: [], error: '高德 Key 的平台类型不匹配，请在高德控制台配置「Web 服务」类型的 Key (10009)' }
    const info = typeof result.info === 'string' ? result.info : '未知错误'
    const code = typeof result.infocode === 'string' ? ` (${result.infocode})` : ''
    return { pois: [], error: `高德地点搜索失败：${info}${code}` }
  }
  if (!Array.isArray(result.pois)) return { pois: [], error: '高德返回了无效地点数据' }
  return { pois: result.pois.filter((poi): poi is AmapPoi => typeof poi === 'object' && poi !== null) }
}

async function requestPois(url: string): Promise<{ pois: AmapPoi[]; error?: string }> {
  try {
    const response = await net.fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) return { pois: [], error: `高德地点搜索请求失败 (HTTP ${response.status})` }
    return parsePois(await response.json())
  } catch {
    return { pois: [], error: '高德地点搜索网络请求失败，请稍后重试' }
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
      error: '未配置高德地图 Web 服务密钥：请在「图层管理 → 供应商密钥」中保存 Web 服务 API Key'
    }
  }
  const params: Record<string, string> = { key, keywords, offset: '8', page: '1', extensions: 'base' }
  if (city?.trim()) params.city = city.trim().slice(0, 40)
  const result = await requestPois(requestUrl('https://restapi.amap.com/v3/place/text', params, securityKey))
  if (result.error) return { query, places: [], error: result.error }
  const places = toPlaces(result.pois).slice(0, 8)
  if (places.length === 0) return { query, places: [], note: '没有找到匹配的地点，可尝试更常见的名称' }
  return { query, places }
}
