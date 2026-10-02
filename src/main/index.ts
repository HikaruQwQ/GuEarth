import { app, shell, BrowserWindow, ipcMain, net, protocol } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import type { GeoPosition, GuEarthSettings, GuEarthSettingsPatch, ProviderCredentialStatus, StoredShape, TileCacheEntry, TileCacheStats, TileKey } from '../preload'
import { assertEncryptionAvailable, assertSafeId, clearProviderKey, hasProviderKey, initKeyVault, readProviderKey, writeProviderKey } from './keyVault'
import { baiduLngLatToTile, tileCenter, wgs84ToBd09 } from './geo'
import { AiSettingsStore } from './ai/settingsStore'
import { registerAiIpcHandlers } from './ai/agent'
import { searchPlaces } from './ai/amap'
import { findPeaks } from './places'

interface PersistedSettings {
  selectedImageryProviderId: string
  selectedTerrainProviderId: string
  terrainExaggeration: number
  terrainLighting: boolean
  tileCacheEnabled: boolean
  providerStyles: Record<string, string>
  providerCredentials: Record<string, ProviderCredentialStatus>
  sceneMode: '2D' | '3D'
}

const defaultSettings: PersistedSettings = {
  selectedImageryProviderId: 'osm',
  selectedTerrainProviderId: 'arcgis-terrain',
  terrainExaggeration: 2,
  terrainLighting: false,
  tileCacheEnabled: true,
  providerStyles: {
    osm: 'standard',
    'esri-imagery': 'satellite',
    opentopomap: 'topo',
    baidu: 'road'
  },
  providerCredentials: {},
  sceneMode: '3D'
}

let settingsPath = ''
let tileCachePath = ''
let annotationsPath = ''
let settings: PersistedSettings = { ...defaultSettings, providerCredentials: {} }
let shapes: StoredShape[] = []
const aiSettings = new AiSettingsStore()

protocol.registerSchemesAsPrivileged([
  { scheme: 'guearth-tile', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const safeId = assertSafeId

function readSettings(): PersistedSettings {
  if (!existsSync(settingsPath)) return { ...defaultSettings, providerCredentials: {} }
  try {
    const parsed: unknown = JSON.parse(readFileSync(settingsPath, 'utf8'))
    if (!isRecord(parsed)) return { ...defaultSettings, providerCredentials: {} }
    const credentials = isRecord(parsed.providerCredentials) ? parsed.providerCredentials : {}
    const providerCredentials: Record<string, ProviderCredentialStatus> = {}
    for (const [providerId, value] of Object.entries(credentials)) {
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(providerId)) continue
      if (!isRecord(value)) continue
      providerCredentials[providerId] = {
        configured: value.configured === true,
        updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : null
      }
    }
    const providerStyles = isRecord(parsed.providerStyles) ? parsed.providerStyles : {}
    const normalizedStyles: Record<string, string> = { ...defaultSettings.providerStyles }
    for (const [providerId, styleId] of Object.entries(providerStyles)) {
      if (/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(providerId) && typeof styleId === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(styleId)) normalizedStyles[providerId] = styleId
    }
    const legacyTerrain = parsed.terrainExaggeration === undefined
    const storedTerrainProviderId = typeof parsed.selectedTerrainProviderId === 'string' ? parsed.selectedTerrainProviderId : defaultSettings.selectedTerrainProviderId
    const terrainProviderId = storedTerrainProviderId === 'mapbox-terrain' ? 'cesium-world-terrain' : storedTerrainProviderId
    return {
      selectedImageryProviderId: typeof parsed.selectedImageryProviderId === 'string' ? parsed.selectedImageryProviderId : defaultSettings.selectedImageryProviderId,
      selectedTerrainProviderId: legacyTerrain && terrainProviderId === 'ellipsoid' ? defaultSettings.selectedTerrainProviderId : terrainProviderId,
      terrainExaggeration: typeof parsed.terrainExaggeration === 'number' && Number.isFinite(parsed.terrainExaggeration) ? Math.min(5, Math.max(1, parsed.terrainExaggeration)) : defaultSettings.terrainExaggeration,
      terrainLighting: parsed.terrainLighting === true,
      tileCacheEnabled: parsed.tileCacheEnabled !== false,
      providerStyles: normalizedStyles,
      providerCredentials,
      sceneMode: parsed.sceneMode === '2D' ? '2D' : '3D'
    }
  } catch {
    return { ...defaultSettings, providerCredentials: {} }
  }
}

function saveSettings(): void {
  writeFileSync(settingsPath, JSON.stringify(settings), 'utf8')
}

function credentialStatus(providerId: string): ProviderCredentialStatus {
  const configured = hasProviderKey(providerId)
  const saved = settings.providerCredentials[providerId]
  if (!configured) return { configured: false, updatedAt: saved?.updatedAt ?? null }
  return { configured: true, updatedAt: saved?.updatedAt ?? null }
}

function settingsSnapshot(): GuEarthSettings {
  const providerCredentials: Record<string, ProviderCredentialStatus> = {}
  for (const providerId of Object.keys(settings.providerCredentials)) providerCredentials[providerId] = credentialStatus(providerId)
  return { ...settings, providerCredentials }
}

function pathPart(value: number): string {
  if (!Number.isInteger(value)) throw new Error('无效的瓦片坐标')
  return value < 0 ? `n${Math.abs(value)}` : String(value)
}

function tileBasePath(key: TileKey): string {
  return join(tileCachePath, safeId(key.providerId), safeId(key.styleId), pathPart(key.level), pathPart(key.x), pathPart(key.y))
}

function tileDataPath(key: TileKey): string {
  return `${tileBasePath(key)}.bin`
}

function tileMetaPath(key: TileKey): string {
  return `${tileBasePath(key)}.json`
}

function toArrayBuffer(data: Buffer): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}

function readTile(key: TileKey): TileCacheEntry | null {
  const dataPath = tileDataPath(key)
  const metaPath = tileMetaPath(key)
  if (!existsSync(dataPath) || !existsSync(metaPath)) return null
  try {
    const metadata: unknown = JSON.parse(readFileSync(metaPath, 'utf8'))
    if (!isRecord(metadata) || typeof metadata.contentType !== 'string') return null
    const expiresAt = typeof metadata.expiresAt === 'number' ? metadata.expiresAt : null
    if (expiresAt !== null && expiresAt <= Date.now()) {
      unlinkSync(dataPath)
      unlinkSync(metaPath)
      return null
    }
    return { ...key, data: toArrayBuffer(readFileSync(dataPath)), contentType: metadata.contentType, expiresAt }
  } catch {
    return null
  }
}

function writeTile(entry: TileCacheEntry): void {
  const key: TileKey = { providerId: entry.providerId, styleId: entry.styleId, level: entry.level, x: entry.x, y: entry.y }
  const basePath = tileBasePath(key)
  mkdirSync(join(tileCachePath, safeId(key.providerId), safeId(key.styleId), pathPart(key.level), pathPart(key.x)), { recursive: true })
  const data = Buffer.from(entry.data)
  writeFileSync(`${basePath}.bin`, data)
  writeFileSync(`${basePath}.json`, JSON.stringify({ contentType: entry.contentType, expiresAt: entry.expiresAt }), 'utf8')
}

function collectFiles(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(path, entry.name)
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath]
  })
}

function cacheStats(): TileCacheStats {
  return collectFiles(tileCachePath).reduce<TileCacheStats>((result, path) => {
    if (path.endsWith('.bin')) {
      result.files += 1
      result.bytes += statSync(path).size
    }
    return result
  }, { files: 0, bytes: 0 })
}

function computeBaiduSn(path: string, queryString: string, sk: string): string {
  const plaintext = encodeURIComponent(`${path}?${queryString}${sk}`)
  return createHash('md5').update(plaintext).digest('hex')
}

function tileRemoteUrl(providerId: string, styleId: string, level: number, x: number, y: number): string | undefined {
  const key = readProviderKey(providerId)
  const subdomain = String(((x % 4) + 4) % 4)
  if (providerId === 'baidu') {
    if (!key) return undefined
    const [translatedX, translatedY] = baiduLngLatToTile(level, ...wgs84ToBd09(...tileCenter(level, x, y)))
    const ak = key
    const sk = readProviderKey(`${providerId}-sk`)
    if (styleId === 'satellite') {
      const baseQueryString = `qt=satepc&x=${translatedX}&y=${translatedY}&z=${level}&udt=20230101&ak=${encodeURIComponent(ak)}`
      if (!sk) return `https://maponline${subdomain}.bdimg.com/tile/?${baseQueryString}`
      const sn = computeBaiduSn('/tile/', baseQueryString, sk)
      return `https://maponline${subdomain}.bdimg.com/tile/?${baseQueryString}&sn=${sn}`
    }
    const baseQueryString = `x=${translatedX}&y=${translatedY}&z=${level}&ak=${encodeURIComponent(ak)}`
    if (!sk) return `https://online${subdomain}.map.bdimg.com/onlinelabel/?qt=tile&${baseQueryString}&styles=pl&scaler=1&udt=20230101`
    const pathWithQuery = `/onlinelabel/?qt=tile&${baseQueryString}&styles=pl&scaler=1&udt=20230101`
    const sn = computeBaiduSn('/onlinelabel/', `qt=tile&${baseQueryString}&styles=pl&scaler=1&udt=20230101`, sk)
    return `https://online${subdomain}.map.bdimg.com${pathWithQuery}&sn=${sn}`
  }
  return undefined
}

async function handleTileProtocol(request: Request): Promise<Response> {
  const parsed = new URL(request.url)
  const providerId = safeId(parsed.hostname)
  const parts = parsed.pathname.split('/').filter(Boolean)
  if (parts.length !== 4) return new Response('Bad tile path', { status: 400 })
  const styleId = safeId(parts[0])
  const coordinates = parts.slice(1).map(Number)
  if (!Number.isInteger(coordinates[0]) || coordinates[0] < 0 || !Number.isInteger(coordinates[1]) || !Number.isInteger(coordinates[2])) return new Response('Bad tile path', { status: 400 })
  const [level, x, y] = coordinates
  const key = { providerId, styleId, level, x, y }
  if (settings.tileCacheEnabled) {
    const cached = readTile(key)
    if (cached) return new Response(cached.data, { headers: { 'content-type': cached.contentType, 'x-guearth-cache': 'hit' } })
  }
  const remoteUrl = tileRemoteUrl(providerId, styleId, level, x, y)
  if (!remoteUrl) return new Response('Unknown provider', { status: 404 })
  try {
    const response = await net.fetch(remoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      }
    })
    if (!response.ok) return new Response(`Tile request failed: ${response.status}`, { status: response.status })
    const data = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') ?? 'image/png'
    if (settings.tileCacheEnabled) void writeTile({ ...key, data, contentType, expiresAt: Date.now() + 86400000 })
    return new Response(data, { headers: { 'content-type': contentType, 'x-guearth-cache': 'miss' } })
  } catch {
    const cached = readTile(key)
    if (cached) return new Response(cached.data, { headers: { 'content-type': cached.contentType, 'x-guearth-cache': 'stale' } })
    return new Response('Tile unavailable', { status: 502 })
  }
}

function normalizeShape(value: unknown): StoredShape {
  if (!isRecord(value)) throw new Error('无效的标注数据')
  const id = safeId(value.id)
  if (value.kind !== 'point' && value.kind !== 'polyline' && value.kind !== 'polygon') throw new Error('无效的标注类型')
  if (!Array.isArray(value.positions)) throw new Error('无效的标注坐标')
  const positions: GeoPosition[] = value.positions.map((item) => {
    if (!isRecord(item)) throw new Error('无效的标注坐标')
    const { longitude, latitude, height } = item
    if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('无效的标注坐标')
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('无效的标注坐标')
    if (typeof height !== 'number' || !Number.isFinite(height) || height < -11000 || height > 20000) throw new Error('无效的标注坐标')
    return { longitude, latitude, height }
  })
  const minimum = value.kind === 'point' ? 1 : value.kind === 'polyline' ? 2 : 3
  if (positions.length < minimum || positions.length > 500) throw new Error('无效的标注坐标')
  return {
    id,
    kind: value.kind,
    positions,
    annotation: typeof value.annotation === 'string' ? value.annotation.slice(0, 200) : '',
    createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : Date.now()
  }
}

function readShapes(): StoredShape[] {
  if (!existsSync(annotationsPath)) return []
  try {
    const parsed: unknown = JSON.parse(readFileSync(annotationsPath, 'utf8'))
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      try {
        return [normalizeShape(item)]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

function saveShapes(): void {
  writeFileSync(annotationsPath, JSON.stringify(shapes), 'utf8')
}

function registerIpcHandlers(): void {
  ipcMain.handle('settings:get', () => settingsSnapshot())
  ipcMain.handle('settings:update', (_event, patch: GuEarthSettingsPatch): GuEarthSettings => {
    if (!isRecord(patch)) throw new Error('无效的设置')
    const nextSettings: PersistedSettings = {
      ...settings,
      providerCredentials: settings.providerCredentials
    }
    if (patch.selectedImageryProviderId !== undefined) nextSettings.selectedImageryProviderId = safeId(patch.selectedImageryProviderId)
    if (patch.selectedTerrainProviderId !== undefined) nextSettings.selectedTerrainProviderId = safeId(patch.selectedTerrainProviderId)
    if (patch.terrainExaggeration !== undefined) {
      if (typeof patch.terrainExaggeration !== 'number' || !Number.isFinite(patch.terrainExaggeration)) throw new Error('无效的地形夸张设置')
      nextSettings.terrainExaggeration = Math.min(5, Math.max(1, patch.terrainExaggeration))
    }
    if (patch.terrainLighting !== undefined) {
      if (typeof patch.terrainLighting !== 'boolean') throw new Error('无效的光照设置')
      nextSettings.terrainLighting = patch.terrainLighting
    }
    if (patch.tileCacheEnabled !== undefined) {
      if (typeof patch.tileCacheEnabled !== 'boolean') throw new Error('无效的缓存设置')
      nextSettings.tileCacheEnabled = patch.tileCacheEnabled
    }
    if (patch.providerStyles !== undefined) {
      if (!isRecord(patch.providerStyles)) throw new Error('无效的影像样式')
      const providerStyles = { ...settings.providerStyles }
      for (const [providerId, styleId] of Object.entries(patch.providerStyles)) {
        providerStyles[safeId(providerId)] = safeId(styleId)
      }
      nextSettings.providerStyles = providerStyles
    }
    if (patch.sceneMode !== undefined) {
      if (patch.sceneMode !== '2D' && patch.sceneMode !== '3D') throw new Error('无效的场景模式')
      nextSettings.sceneMode = patch.sceneMode
    }
    settings = nextSettings
    saveSettings()
    return settingsSnapshot()
  })
  ipcMain.handle('settings:set-provider-api-key', (_event, providerId: string, apiKey: string): ProviderCredentialStatus => {
    const id = safeId(providerId)
    writeProviderKey(id, apiKey)
    const status = { configured: true, updatedAt: Date.now() }
    settings.providerCredentials[id] = status
    saveSettings()
    return status
  })
  ipcMain.handle('settings:clear-provider-api-key', (_event, providerId: string): ProviderCredentialStatus => {
    const id = safeId(providerId)
    clearProviderKey(id)
    const status = { configured: false, updatedAt: null }
    settings.providerCredentials[id] = status
    saveSettings()
    return status
  })
  ipcMain.handle('settings:has-provider-api-key', (_event, providerId: string): ProviderCredentialStatus => credentialStatus(safeId(providerId)))
  ipcMain.handle('places:search', (_event, keyword: unknown) => {
    if (typeof keyword !== 'string') throw new Error('无效的搜索关键词')
    return searchPlaces(keyword)
  })
  ipcMain.handle('tiles:get', (_event, key: TileKey) => readTile(key))
  ipcMain.handle('tiles:put', (_event, entry: TileCacheEntry) => writeTile(entry))
  ipcMain.handle('tiles:clear', (_event, providerId?: string) => {
    if (providerId === undefined) {
      rmSync(tileCachePath, { recursive: true, force: true })
      mkdirSync(tileCachePath, { recursive: true })
      return
    }
    rmSync(join(tileCachePath, safeId(providerId)), { recursive: true, force: true })
  })
  ipcMain.handle('tiles:stats', () => cacheStats())
  ipcMain.handle('places:peaks', (_event, bounds: unknown, minElevation: unknown) => findPeaks(bounds, minElevation))
  ipcMain.handle('annotations:list', (): StoredShape[] => shapes)
  ipcMain.handle('annotations:save', (_event, shape: unknown): void => {
    const stored = normalizeShape(shape)
    const index = shapes.findIndex((item) => item.id === stored.id)
    if (index === -1) shapes.push(stored)
    else shapes[index] = stored
    saveShapes()
  })
  ipcMain.handle('annotations:remove', (_event, id: string): void => {
    shapes = shapes.filter((item) => item.id !== safeId(id))
    saveShapes()
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    title: 'GuEarth',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData')
  settingsPath = join(userDataPath, 'settings.json')
  tileCachePath = join(userDataPath, 'tile-cache')
  annotationsPath = join(userDataPath, 'annotations.json')
  initKeyVault(join(userDataPath, 'credentials'))
  mkdirSync(tileCachePath, { recursive: true })
  settings = readSettings()
  shapes = readShapes()
  aiSettings.init(join(userDataPath, 'ai-settings.json'))
  registerIpcHandlers()
  registerAiIpcHandlers(aiSettings)
  protocol.handle('guearth-tile', handleTileProtocol)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
