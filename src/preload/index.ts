import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AnnotationData,
  AnnotationStoreData,
  GeoBounds,
  GeoImportPayload,
  GuEarthSettings,
  GuEarthSettingsPatch,
  KmlExportAsset,
  PeakResult,
  ProviderCredentialStatus,
  TileCacheEntry,
  TileCacheStats,
  TileKey
} from './types'

export type {
  AnnotationData,
  AnnotationGroup,
  AnnotationIcon,
  AnnotationKind,
  AnnotationStoreData,
  AnnotationStyle,
  GeoBounds,
  GeoImportAsset,
  GeoImportPayload,
  GroundOverlayData,
  GuEarthSettings,
  GuEarthSettingsPatch,
  KmlExportAsset,
  PeakResult,
  ProviderCredentialStatus,
  TileCacheEntry,
  TileCacheStats,
  TileKey
} from './types'

export type AiProtocol = 'openai' | 'anthropic'
export type AiThinkingLevel = 'low' | 'medium' | 'high'

export interface AiModelConfig {
  id: string
  label: string
  contextWindow: number
  streaming: boolean
  thinking: boolean
  thinkingLevel: AiThinkingLevel
}

export interface AiProviderConfig {
  id: string
  name: string
  protocol: AiProtocol
  baseUrl: string
  models: AiModelConfig[]
}

export interface AiSettings {
  providers: AiProviderConfig[]
  activeProviderId: string
  activeModelId: string
}

export interface AiChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AiToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type AiChatEvent =
  | { sessionId: string; type: 'reasoning-delta'; text: string }
  | { sessionId: string; type: 'text-delta'; text: string }
  | { sessionId: string; type: 'tool-start'; callId: string; name: string; args: unknown }
  | { sessionId: string; type: 'tool-end'; callId: string; ok: boolean; summary: string; result: string }
  | { sessionId: string; type: 'execute-tool'; callId: string; name: string; args: unknown }
  | { sessionId: string; type: 'done' }
  | { sessionId: string; type: 'error'; message: string }

export interface PlaceSuggestion {
  name: string
  province: string
  city: string
  district: string
  address: string
  type: string
  longitude: number
  latitude: number
}

export interface PlaceSearchResult {
  query: string
  places: PlaceSuggestion[]
  note?: string
  error?: string
}

const api = {
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  },
  settings: {
    get: (): Promise<GuEarthSettings> => ipcRenderer.invoke('settings:get'),
    update: (patch: GuEarthSettingsPatch): Promise<GuEarthSettings> => ipcRenderer.invoke('settings:update', patch),
    setProviderApiKey: (providerId: string, apiKey: string): Promise<ProviderCredentialStatus> => ipcRenderer.invoke('settings:set-provider-api-key', providerId, apiKey),
    clearProviderApiKey: (providerId: string): Promise<ProviderCredentialStatus> => ipcRenderer.invoke('settings:clear-provider-api-key', providerId),
    hasProviderApiKey: (providerId: string): Promise<ProviderCredentialStatus> => ipcRenderer.invoke('settings:has-provider-api-key', providerId)
  },
  tiles: {
    get: (key: TileKey): Promise<TileCacheEntry | null> => ipcRenderer.invoke('tiles:get', key),
    put: (entry: TileCacheEntry): Promise<void> => ipcRenderer.invoke('tiles:put', entry),
    clear: (providerId?: string): Promise<void> => ipcRenderer.invoke('tiles:clear', providerId),
    stats: (): Promise<TileCacheStats> => ipcRenderer.invoke('tiles:stats')
  },
  places: {
    search: (keyword: string): Promise<PlaceSearchResult> => ipcRenderer.invoke('places:search', keyword),
    peaks: (bounds: GeoBounds, minElevation?: number): Promise<PeakResult[]> => ipcRenderer.invoke('places:peaks', bounds, minElevation)
  },
  annotations: {
    list: (): Promise<AnnotationStoreData> => ipcRenderer.invoke('annotations:list'),
    add: (annotation: AnnotationData): Promise<AnnotationStoreData> => ipcRenderer.invoke('annotations:add', annotation),
    update: (annotation: AnnotationData): Promise<AnnotationStoreData> => ipcRenderer.invoke('annotations:update', annotation),
    remove: (id: string): Promise<AnnotationStoreData> => ipcRenderer.invoke('annotations:remove', id),
    saveAll: (store: AnnotationStoreData): Promise<AnnotationStoreData> => ipcRenderer.invoke('annotations:save-all', store),
    removeOverlayAssets: (assetDir: string): Promise<void> => ipcRenderer.invoke('geoio:remove-overlay-assets', assetDir)
  },
  geoio: {
    pickImport: (): Promise<GeoImportPayload | null> => ipcRenderer.invoke('geoio:pick-import'),
    readFile: (filePath: string): Promise<GeoImportPayload> => ipcRenderer.invoke('geoio:read-file', filePath),
    saveKml: (defaultName: string, kmlText: string, assets: KmlExportAsset[]): Promise<string | null> => ipcRenderer.invoke('geoio:save-kml', defaultName, kmlText, assets),
    saveBinary: (defaultName: string, base64: string, extension: string, mime: string): Promise<string | null> => ipcRenderer.invoke('geoio:save-binary', defaultName, base64, extension, mime)
  },
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  ai: {
    getSettings: (): Promise<AiSettings> => ipcRenderer.invoke('ai:get-settings'),
    updateSettings: (settings: AiSettings): Promise<AiSettings> => ipcRenderer.invoke('ai:update-settings', settings),
    chat: (sessionId: string, turns: AiChatTurn[], tools: AiToolDefinition[]): Promise<void> => ipcRenderer.invoke('ai:chat', sessionId, turns, tools),
    stop: (sessionId: string): Promise<void> => ipcRenderer.invoke('ai:stop', sessionId),
    toolResult: (sessionId: string, callId: string, ok: boolean, result: unknown): Promise<void> => ipcRenderer.invoke('ai:tool-result', sessionId, callId, ok, result),
    onEvent: (listener: (event: AiChatEvent) => void): (() => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: AiChatEvent): void => listener(payload)
      ipcRenderer.on('ai:event', wrapped)
      return () => ipcRenderer.removeListener('ai:event', wrapped)
    }
  }
}

export type GuEarthApi = typeof api

contextBridge.exposeInMainWorld('guEarth', api)
