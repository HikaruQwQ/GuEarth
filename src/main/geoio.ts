import { BrowserWindow, dialog, ipcMain } from 'electron'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { randomBytes } from 'crypto'
import { extname, join } from 'path'
import type { GeoImportPayload, KmlExportAsset } from '../preload'
import { unzip, zipFiles } from './zip'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']
const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.kml': 'application/vnd.google-earth.kml+xml',
  '.kmz': 'application/vnd.google-earth.kmz',
  '.gpx': 'application/gpx+xml',
  '.geojson': 'application/geo+json',
  '.csv': 'text/csv'
}

let overlaysPath = ''

export function initGeoio(userDataPath: string): void {
  overlaysPath = join(userDataPath, 'overlays')
  mkdirSync(overlaysPath, { recursive: true })
}

function isSafeName(value: string): boolean {
  return /^[^/\\:*?"<>|\x00-\x1f]+$/.test(value) && value !== '.' && value !== '..' && value.length <= 200
}

export function assetUrl(assetDir: string, fileName: string): string {
  return `guearth-asset://${assetDir}/${encodeURIComponent(fileName)}`
}

export function handleAssetProtocol(request: Request): Response {
  const parsed = new URL(request.url)
  const assetDir = parsed.hostname
  const fileName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean)[0] ?? '')
  if (!/^[a-f0-9]{16}$/.test(assetDir) || !isSafeName(fileName)) return new Response('Bad asset path', { status: 400 })
  const filePath = join(overlaysPath, assetDir, fileName)
  if (!existsSync(filePath)) return new Response('Asset not found', { status: 404 })
  const contentType = MIME_BY_EXTENSION[extname(fileName).toLowerCase()] ?? 'application/octet-stream'
  return new Response(readFileSync(filePath), { headers: { 'content-type': contentType, 'cache-control': 'no-cache' } })
}

function extractKmz(data: Buffer, fileName: string): GeoImportPayload {
  const entries = unzip(data)
  const kmlEntry =
    entries.find((entry) => entry.name === 'doc.kml') ??
    entries.find((entry) => entry.name.toLowerCase().endsWith('.kml'))
  if (!kmlEntry) throw new Error('KMZ 中未找到 KML 文件')
  const assetDir = randomBytes(8).toString('hex')
  const assetDirPath = join(overlaysPath, assetDir)
  mkdirSync(assetDirPath, { recursive: true })
  const assets: GeoImportPayload['assets'] = []
  for (const entry of entries) {
    if (entry === kmlEntry) continue
    const extension = extname(entry.name).toLowerCase()
    if (!IMAGE_EXTENSIONS.includes(extension)) continue
    const baseName = entry.name.split('/').pop() ?? entry.name
    if (!isSafeName(baseName)) continue
    writeFileSync(join(assetDirPath, baseName), entry.data)
    assets.push({ href: entry.name, assetUrl: assetUrl(assetDir, baseName) })
  }
  if (assets.length === 0) rmSync(assetDirPath, { recursive: true, force: true })
  return { fileName, format: 'kml', text: kmlEntry.data.toString('utf8'), assets }
}

export function readImportFile(filePath: string, browserWindow: BrowserWindow): GeoImportPayload {
  const extension = extname(filePath).toLowerCase()
  const fileName = filePath.split(/[\\/]/).pop() ?? 'import'
  if (extension === '.kmz') return extractKmz(readFileSync(filePath), fileName)
  if (extension === '.kml' || extension === '.gpx') {
    return { fileName, format: extension === '.kml' ? 'kml' : 'gpx', text: readFileSync(filePath, 'utf8'), assets: [] }
  }
  throw new Error('仅支持 KML / KMZ / GPX 文件')
}

async function pickImportFile(browserWindow: BrowserWindow): Promise<GeoImportPayload | null> {
  const selection = await dialog.showOpenDialog(browserWindow, {
    title: '导入地理数据',
    filters: [{ name: '地理数据', extensions: ['kml', 'kmz', 'gpx'] }],
    properties: ['openFile']
  })
  if (selection.canceled || selection.filePaths.length === 0) return null
  return readImportFile(selection.filePaths[0], browserWindow)
}

function baseNameWithoutExtension(fileName: string): string {
  const base = fileName.replace(/[\\/]/g, '-')
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}

function sanitizeExtension(extension: string): string {
  return extension.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

async function saveBinary(browserWindow: BrowserWindow, defaultName: string, base64: string, extension: string, mime: string): Promise<string | null> {
  const safeExtension = sanitizeExtension(extension) || 'bin'
  const selection = await dialog.showSaveDialog(browserWindow, {
    title: '保存文件',
    defaultPath: `${baseNameWithoutExtension(defaultName)}.${safeExtension}`,
    filters: [{ name: safeExtension.toUpperCase(), extensions: [safeExtension] }]
  })
  if (selection.canceled || !selection.filePath) return null
  writeFileSync(selection.filePath, Buffer.from(base64, 'base64'))
  return selection.filePath
}

async function saveKml(browserWindow: BrowserWindow, defaultName: string, kmlText: string, assets: KmlExportAsset[]): Promise<string | null> {
  const useKmz = assets.length > 0
  const selection = await dialog.showSaveDialog(browserWindow, {
    title: '导出标注',
    defaultPath: `${baseNameWithoutExtension(defaultName)}.${useKmz ? 'kmz' : 'kml'}`,
    filters: useKmz
      ? [{ name: 'KMZ', extensions: ['kmz'] }]
      : [{ name: 'KML', extensions: ['kml'] }]
  })
  if (selection.canceled || !selection.filePath) return null
  if (!useKmz) {
    writeFileSync(selection.filePath, kmlText, 'utf8')
    return selection.filePath
  }
  const entries = [{ name: 'doc.kml', data: Buffer.from(kmlText, 'utf8') }]
  for (const asset of assets) {
    const source = join(overlaysPath, asset.assetDir, asset.fileName)
    if (!existsSync(source)) continue
    entries.push({ name: asset.zipPath, data: readFileSync(source) })
  }
  writeFileSync(selection.filePath, zipFiles(entries))
  return selection.filePath
}

export function removeOverlayAssets(assetDir: string): void {
  if (!/^[a-f0-9]{16}$/.test(assetDir)) return
  const dir = join(overlaysPath, assetDir)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

export function isOverlayAssetDirInUse(assetDir: string, overlays: Array<{ assetDir: string | null }>): boolean {
  return overlays.some((overlay) => overlay.assetDir === assetDir)
}

export function collectOrphanOverlayDirs(overlays: Array<{ assetDir: string | null }>): string[] {
  if (!existsSync(overlaysPath)) return []
  const usedDirs = new Set(overlays.map((overlay) => overlay.assetDir).filter((dir): dir is string => dir !== null))
  return readdirSync(overlaysPath).filter((dir) => /^[a-f0-9]{16}$/.test(dir) && !usedDirs.has(dir))
}

export function registerGeoioIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('geoio:pick-import', async (): Promise<GeoImportPayload | null> => {
    const win = getWindow()
    if (!win) return null
    return pickImportFile(win)
  })
  ipcMain.handle('geoio:read-file', async (_event, filePath: unknown): Promise<GeoImportPayload> => {
    const win = getWindow()
    if (!win) throw new Error('窗口不可用')
    if (typeof filePath !== 'string' || filePath.length === 0) throw new Error('无效的文件路径')
    return readImportFile(filePath, win)
  })
  ipcMain.handle('geoio:save-kml', async (_event, defaultName: unknown, kmlText: unknown, assets: unknown): Promise<string | null> => {
    const win = getWindow()
    if (!win) return null
    if (typeof defaultName !== 'string' || typeof kmlText !== 'string') throw new Error('无效的导出内容')
    const assetList = Array.isArray(assets)
      ? assets.filter(
          (asset): asset is KmlExportAsset =>
            typeof asset === 'object' && asset !== null &&
            typeof (asset as KmlExportAsset).assetDir === 'string' &&
            typeof (asset as KmlExportAsset).fileName === 'string' &&
            typeof (asset as KmlExportAsset).zipPath === 'string' &&
            isSafeName((asset as KmlExportAsset).zipPath.replace(/\//g, '-'))
        )
      : []
    return saveKml(win, defaultName, kmlText, assetList)
  })
  ipcMain.handle('geoio:remove-overlay-assets', (_event, assetDir: unknown): void => {
    if (typeof assetDir !== 'string' || !/^[a-f0-9]{16}$/.test(assetDir)) throw new Error('无效的资产目录')
    removeOverlayAssets(assetDir)
  })
  ipcMain.handle('geoio:save-binary', async (_event, defaultName: unknown, base64: unknown, extension: unknown, mime: unknown): Promise<string | null> => {
    const win = getWindow()
    if (!win) return null
    if (typeof defaultName !== 'string' || typeof base64 !== 'string' || typeof extension !== 'string' || extension.length === 0 || extension.length > 10) throw new Error('无效的导出内容')
    return saveBinary(win, defaultName, base64, extension, typeof mime === 'string' && mime ? mime : MIME_BY_EXTENSION[`.${sanitizeExtension(extension)}`] ?? 'application/octet-stream')
  })
}
