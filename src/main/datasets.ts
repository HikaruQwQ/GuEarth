import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { net } from 'electron'
import type { EarthquakeFeed } from '../preload'

const EARTHQUAKE_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson'
const CACHE_TTL_MS = 6 * 3600 * 1000
const FETCH_TIMEOUT_MS = 15000

let earthquakesPath = ''

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function initDatasets(userDataPath: string): void {
  earthquakesPath = join(userDataPath, 'earthquakes.json')
}

function readCachedFeed(): EarthquakeFeed | null {
  if (!existsSync(earthquakesPath)) return null
  try {
    const parsed: unknown = JSON.parse(readFileSync(earthquakesPath, 'utf8'))
    if (!isRecord(parsed) || typeof parsed.fetchedAt !== 'number' || !Array.isArray(parsed.events)) return null
    const events = parsed.events.filter((item): item is EarthquakeFeed['events'][number] =>
      isRecord(item)
      && typeof item.magnitude === 'number'
      && Number.isFinite(item.magnitude)
      && Number.isFinite(item.longitude)
      && Number.isFinite(item.latitude)
      && Number.isFinite(item.depthKm)
      && typeof item.place === 'string'
      && Number.isFinite(item.time)
    )
    return { fetchedAt: parsed.fetchedAt, events }
  } catch {
    return null
  }
}

function parseFeed(json: unknown): EarthquakeFeed['events'] {
  if (!isRecord(json) || !Array.isArray(json.features)) return []
  const events: EarthquakeFeed['events'] = []
  for (const feature of json.features) {
    if (!isRecord(feature)) continue
    const properties = isRecord(feature.properties) ? feature.properties : {}
    const geometry = isRecord(feature.geometry) ? feature.geometry : {}
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : []
    const [longitude, latitude, depth] = coordinates
    const magnitude = Number(properties.mag)
    if (!Number.isFinite(magnitude) || magnitude < 4.5) continue
    if (typeof longitude !== 'number' || typeof latitude !== 'number') continue
    events.push({
      magnitude: Math.round(magnitude * 10) / 10,
      longitude: Math.max(-180, Math.min(180, longitude)),
      latitude: Math.max(-90, Math.min(90, latitude)),
      depthKm: typeof depth === 'number' && Number.isFinite(depth) ? Math.round(depth) : 0,
      place: typeof properties.place === 'string' ? properties.place : '未知位置',
      time: typeof properties.time === 'number' && Number.isFinite(properties.time) ? properties.time : 0
    })
  }
  return events.sort((a, b) => a.time - b.time)
}

async function fetchFeed(): Promise<EarthquakeFeed['events']> {
  const response = await net.fetch(EARTHQUAKE_FEED_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GuEarth/0.1' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  })
  if (!response.ok) throw new Error(`USGS request failed: ${response.status}`)
  return parseFeed(await response.json())
}

export async function loadEarthquakeFeed(): Promise<EarthquakeFeed> {
  const cached = readCachedFeed()
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached
  try {
    const feed: EarthquakeFeed = { fetchedAt: Date.now(), events: await fetchFeed() }
    writeFileSync(earthquakesPath, JSON.stringify(feed), 'utf8')
    return feed
  } catch (error) {
    if (cached) return cached
    throw error instanceof Error ? error : new Error('USGS request failed')
  }
}
