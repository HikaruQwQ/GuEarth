import { app, shell, BrowserWindow, ipcMain, safeStorage, net, protocol } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import type { GuEarthSettings, GuEarthSettingsPatch, ProviderCredentialStatus, TileCacheEntry, TileCacheStats, TileKey } from '../preload'

interface PersistedSettings {
  selectedImageryProviderId: string
  selectedTerrainProviderId: string
  tileCacheEnabled: boolean
  selectionMode: 'manual' | 'auto'
  chinaProviderId: string
  globalProviderId: string
  providerStyles: Record<string, string>
  providerCredentials: Record<string, ProviderCredentialStatus>
  sceneMode: '2D' | '3D'
}

const defaultSettings: PersistedSettings = {
  selectedImageryProviderId: 'osm',
  selectedTerrainProviderId: 'ellipsoid',
  tileCacheEnabled: true,
  selectionMode: 'manual',
  chinaProviderId: 'amap',
  globalProviderId: 'osm',
  providerStyles: {
    osm: 'standard',
    'esri-imagery': 'satellite',
    opentopomap: 'topo',
    amap: 'road',
    baidu: 'road',
    tianditu: 'road'
  },
  providerCredentials: {},
  sceneMode: '3D'
}

let settingsPath = ''
let credentialsPath = ''
let tileCachePath = ''
let settings: PersistedSettings = { ...defaultSettings, providerCredentials: {} }

protocol.registerSchemesAsPrivileged([
  { scheme: 'guearth-tile', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)) throw new Error('无效的供应商标识')
  return value
}

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
    return {
      selectedImageryProviderId: typeof parsed.selectedImageryProviderId === 'string' ? parsed.selectedImageryProviderId : defaultSettings.selectedImageryProviderId,
      selectedTerrainProviderId: typeof parsed.selectedTerrainProviderId === 'string' ? parsed.selectedTerrainProviderId : defaultSettings.selectedTerrainProviderId,
      tileCacheEnabled: parsed.tileCacheEnabled !== false,
      selectionMode: parsed.selectionMode === 'auto' ? 'auto' : 'manual',
      chinaProviderId: typeof parsed.chinaProviderId === 'string' ? parsed.chinaProviderId : defaultSettings.chinaProviderId,
      globalProviderId: typeof parsed.globalProviderId === 'string' ? parsed.globalProviderId : defaultSettings.globalProviderId,
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

function credentialPath(providerId: string): string {
  return join(credentialsPath, `${safeId(providerId)}.bin`)
}

function credentialStatus(providerId: string): ProviderCredentialStatus {
  const configured = existsSync(credentialPath(providerId))
  const saved = settings.providerCredentials[providerId]
  if (!configured) return { configured: false, updatedAt: saved?.updatedAt ?? null }
  return { configured: true, updatedAt: saved?.updatedAt ?? null }
}

function settingsSnapshot(): GuEarthSettings {
  const providerCredentials: Record<string, ProviderCredentialStatus> = {}
  for (const providerId of Object.keys(settings.providerCredentials)) providerCredentials[providerId] = credentialStatus(providerId)
  return { ...settings, providerCredentials }
}

function assertEncryptionAvailable(): void {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储不可用')
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

function readProviderKey(providerId: string): string | undefined {
  const path = credentialPath(providerId)
  if (!existsSync(path) || !safeStorage.isEncryptionAvailable()) return undefined
  try {
    return safeStorage.decryptString(readFileSync(path))
  } catch {
    return undefined
  }
}

function readProviderSk(providerId: string): string | undefined {
  const path = credentialPath(`${providerId}-sk`)
  if (!existsSync(path) || !safeStorage.isEncryptionAvailable()) return undefined
  try {
    return safeStorage.decryptString(readFileSync(path))
  } catch {
    return undefined
  }
}

function readProviderSecurityKey(providerId: string): string | undefined {
  return readProviderSk(providerId)
}

function computeBaiduSn(path: string, queryString: string, sk: string): string {
  const plaintext = encodeURIComponent(`${path}?${queryString}${sk}`)
  return createHash('md5').update(plaintext).digest('hex')
}

const coordinatePi = Math.PI
const coordinateAxis = 6378245
const coordinateEccentricity = 0.006693421622965943

function outOfChina(longitude: number, latitude: number): boolean {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271
}

function transformLatitude(x: number, y: number): number {
  let value = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  value += (20 * Math.sin(6 * x * coordinatePi) + 20 * Math.sin(2 * x * coordinatePi)) * 2 / 3
  value += (20 * Math.sin(y * coordinatePi) + 40 * Math.sin(y / 3 * coordinatePi)) * 2 / 3
  value += (160 * Math.sin(y / 12 * coordinatePi) + 320 * Math.sin(y * coordinatePi / 30)) * 2 / 3
  return value
}

function transformLongitude(x: number, y: number): number {
  let value = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  value += (20 * Math.sin(6 * x * coordinatePi) + 20 * Math.sin(2 * x * coordinatePi)) * 2 / 3
  value += (20 * Math.sin(x * coordinatePi) + 40 * Math.sin(x / 3 * coordinatePi)) * 2 / 3
  value += (150 * Math.sin(x / 12 * coordinatePi) + 300 * Math.sin(x / 30 * coordinatePi)) * 2 / 3
  return value
}

function wgs84ToGcj02(longitude: number, latitude: number): [number, number] {
  if (outOfChina(longitude, latitude)) return [longitude, latitude]
  const deltaLatitude = transformLatitude(longitude - 105, latitude - 35)
  const deltaLongitude = transformLongitude(longitude - 105, latitude - 35)
  const latitudeRadians = latitude / 180 * coordinatePi
  const magic = 1 - coordinateEccentricity * Math.sin(latitudeRadians) ** 2
  const sqrtMagic = Math.sqrt(magic)
  const adjustedLatitude = deltaLatitude * 180 / ((coordinateAxis * (1 - coordinateEccentricity)) / (magic * sqrtMagic) * coordinatePi)
  const adjustedLongitude = deltaLongitude * 180 / (coordinateAxis / sqrtMagic * Math.cos(latitudeRadians) * coordinatePi)
  return [longitude + adjustedLongitude, latitude + adjustedLatitude]
}

function gcj02ToBd09(longitude: number, latitude: number): [number, number] {
  const z = Math.sqrt(longitude * longitude + latitude * latitude) + 0.00002 * Math.sin(latitude * coordinatePi)
  const theta = Math.atan2(latitude, longitude) + 0.000003 * Math.cos(longitude * coordinatePi)
  return [z * Math.cos(theta) + 0.0065, z * Math.sin(theta) + 0.006]
}

function wgs84ToBd09(longitude: number, latitude: number): [number, number] {
  const [gcjLongitude, gcjLatitude] = wgs84ToGcj02(longitude, latitude)
  return gcj02ToBd09(gcjLongitude, gcjLatitude)
}

function tileCenter(level: number, x: number, y: number): [number, number] {
  const scale = 2 ** level
  const longitude = (x + 0.5) / scale * 360 - 180
  const mercator = Math.PI * (1 - 2 * (y + 0.5) / scale)
  const latitude = 180 / coordinatePi * Math.atan(Math.sinh(mercator))
  return [longitude, latitude]
}

function geoToTile(level: number, longitude: number, latitude: number): [number, number] {
  const scale = 2 ** level
  const clampedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude))
  const x = Math.max(0, Math.min(scale - 1, Math.floor((longitude + 180) / 360 * scale)))
  const latitudeRadians = clampedLatitude / 180 * coordinatePi
  const y = Math.max(0, Math.min(scale - 1, Math.floor((1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / coordinatePi) / 2 * scale)))
  return [x, y]
}

const baiduMercatorBands = [75, 60, 45, 30, 15, 0]
const baiduMercatorFactors = [
  [-0.0015702102444, 111320.7020616939, 1704480524535203, -10338987376042340, 26112667856603880, -35149669176653700, 26595700718403920, -10725012454188240, 1800819912950474, 82.5],
  [0.0008277824516172526, 111320.7020463578, 647795574.6671607, -4082003173.6413164, 10774905661.35142, -15171875531.51559, 12052655338.62167, -5124939663.577472, 913311935.9512032, 67.5],
  [0.00337398766765, 111320.7020202162, 4481351.045890365, -23393751.19931662, 79682215.47186455, -115964993.2797253, 97236711.15602145, -43661946.33352821, 8477230.501135234, 52.5],
  [0.00220636496208, 111320.7020209128, 51751.86112841131, 3796837.749470245, 992013.7397791013, -1221952.21711287, 1340652.697009075, -620943.6990984312, 144416.9293806241, 37.5],
  [-0.0003441963504368392, 111320.7020576856, 278.2353980772752, 2485758.690035394, 6070.750963243378, 54821.18345352118, 9540.606633304236, -2710.55326746645, 1405.483844121726, 22.5],
  [-0.0003218135878613132, 111320.7020701615, 0.00369383431289, 823725.6402795718, 0.46104986909093, 2351.343141331292, 1.58060784298199, 8.77738589078284, 0.37238884252424, 7.45]
]

function baiduLngLatToPoint(longitude: number, latitude: number): [number, number] {
  const normalizedLongitude = ((longitude + 180) % 360 + 360) % 360 - 180
  const normalizedLatitude = Math.max(-74, Math.min(74, latitude))
  const absoluteLatitude = Math.abs(normalizedLatitude)
  const factorIndex = baiduMercatorBands.findIndex((band) => absoluteLatitude >= band)
  const factor = baiduMercatorFactors[factorIndex === -1 ? baiduMercatorFactors.length - 1 : factorIndex]
  const ratio = absoluteLatitude / factor[9]
  const ratioSquared = ratio * ratio
  const absoluteY = factor[2] + factor[3] * ratio + factor[4] * ratioSquared + factor[5] * ratioSquared * ratio + factor[6] * ratioSquared ** 2 + factor[7] * ratioSquared ** 2 * ratio + factor[8] * ratioSquared ** 3
  const absoluteX = factor[0] + factor[1] * Math.abs(normalizedLongitude)
  return [absoluteX * (normalizedLongitude < 0 ? -1 : 1), absoluteY * (normalizedLatitude < 0 ? -1 : 1)]
}

function baiduLngLatToTile(level: number, longitude: number, latitude: number): [number, number] {
  const [pointX, pointY] = baiduLngLatToPoint(longitude, latitude)
  const retain = 2 ** (level - 18)
  return [Math.floor(pointX * retain / 256), Math.floor(pointY * retain / 256)]
}

function translatedTile(level: number, x: number, y: number, providerId: string): [number, number] {
  const [longitude, latitude] = tileCenter(level, x, y)
  if (providerId === 'amap') return geoToTile(level, ...wgs84ToGcj02(longitude, latitude))
  if (providerId === 'baidu') return baiduLngLatToTile(level, ...wgs84ToBd09(longitude, latitude))
  return [x, y]
}

function tileRemoteUrl(providerId: string, styleId: string, level: number, x: number, y: number): string | undefined {
  const key = readProviderKey(providerId)
  const subdomain = String(((x % 4) + 4) % 4)
  const [translatedX, translatedY] = translatedTile(level, x, y, providerId)
  const amapHost = subdomain === '0' ? 'webrd0' : `webrd0${subdomain}`
  if (providerId === 'amap') {
    const style = styleId === 'satellite' ? 6 : 7
    const securityKey = readProviderSecurityKey(providerId)
    const keyParams = `${key ? `&key=${encodeURIComponent(key)}` : ''}${securityKey ? `&jscode=${encodeURIComponent(securityKey)}` : ''}`
    return `https://${amapHost}.is.autonavi.com/appmaptile?style=${style}&x=${translatedX}&y=${translatedY}&z=${level}${keyParams}`
  }
  if (providerId === 'baidu') {
    if (!key) return undefined
    const ak = key
    const sk = readProviderSk(providerId)
    if (styleId === 'satellite') {
      const uValue = `x=${translatedX};y=${translatedY};z=${level};v=009;type=sate`
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
  if (providerId === 'tianditu') {
    const layer = styleId === 'satellite' ? 'img' : 'vec'
    return `https://t${subdomain}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&TILEMATRIX=${level}&TILEROW=${y}&TILECOL=${x}&FORMAT=tiles${key ? `&tk=${encodeURIComponent(key)}` : ''}`
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
    const response = await net.fetch(remoteUrl)
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
    if (patch.tileCacheEnabled !== undefined) {
      if (typeof patch.tileCacheEnabled !== 'boolean') throw new Error('无效的缓存设置')
      nextSettings.tileCacheEnabled = patch.tileCacheEnabled
    }
    if (patch.selectionMode !== undefined) {
      if (patch.selectionMode !== 'manual' && patch.selectionMode !== 'auto') throw new Error('无效的区域模式')
      nextSettings.selectionMode = patch.selectionMode
    }
    if (patch.chinaProviderId !== undefined) nextSettings.chinaProviderId = safeId(patch.chinaProviderId)
    if (patch.globalProviderId !== undefined) nextSettings.globalProviderId = safeId(patch.globalProviderId)
    if (patch.providerStyles !== undefined) {
      if (!isRecord(patch.providerStyles)) throw new Error('无效的影像样式')
      const providerStyles = { ...settings.providerStyles }
      for (const [providerId, styleId] of Object.entries(patch.providerStyles)) {
        providerStyles[safeId(providerId)] = safeId(styleId)
      }
      nextSettings.providerStyles = providerStyles
    }
    settings = nextSettings
    saveSettings()
    return settingsSnapshot()
  })
  ipcMain.handle('settings:set-provider-api-key', (_event, providerId: string, apiKey: string): ProviderCredentialStatus => {
    assertEncryptionAvailable()
    const id = safeId(providerId)
    if (typeof apiKey !== 'string' || apiKey.length < 1 || apiKey.length > 4096) throw new Error('无效的供应商密钥')
    writeFileSync(credentialPath(id), safeStorage.encryptString(apiKey))
    const status = { configured: true, updatedAt: Date.now() }
    settings.providerCredentials[id] = status
    saveSettings()
    return status
  })
  ipcMain.handle('settings:clear-provider-api-key', (_event, providerId: string): ProviderCredentialStatus => {
    const id = safeId(providerId)
    const path = credentialPath(id)
    if (existsSync(path)) unlinkSync(path)
    const status = { configured: false, updatedAt: null }
    settings.providerCredentials[id] = status
    saveSettings()
    return status
  })
  ipcMain.handle('settings:has-provider-api-key', (_event, providerId: string): ProviderCredentialStatus => credentialStatus(safeId(providerId)))
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
  settingsPath = join(app.getPath('userData'), 'settings.json')
  credentialsPath = join(app.getPath('userData'), 'credentials')
  tileCachePath = join(app.getPath('userData'), 'tile-cache')
  mkdirSync(credentialsPath, { recursive: true })
  mkdirSync(tileCachePath, { recursive: true })
  settings = readSettings()
  registerIpcHandlers()
  protocol.handle('guearth-tile', handleTileProtocol)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
