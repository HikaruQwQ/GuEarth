import { contextBridge, ipcRenderer } from 'electron'

export interface ProviderCredentialStatus {
  configured: boolean
  updatedAt: number | null
}

export interface GuEarthSettings {
  selectedImageryProviderId: string
  selectedTerrainProviderId: string
  terrainExaggeration: number
  terrainLighting: boolean
  tileCacheEnabled: boolean
  providerStyles: Record<string, string>
  providerCredentials: Record<string, ProviderCredentialStatus>
  sceneMode: '2D' | '3D'
}

export interface GuEarthSettingsPatch {
  selectedImageryProviderId?: string
  selectedTerrainProviderId?: string
  terrainExaggeration?: number
  terrainLighting?: boolean
  tileCacheEnabled?: boolean
  providerStyles?: Record<string, string>
  sceneMode?: '2D' | '3D'
}

export interface TileKey {
  providerId: string
  styleId: string
  level: number
  x: number
  y: number
}

export interface TileCacheEntry extends TileKey {
  data: ArrayBuffer
  contentType: string
  expiresAt: number | null
}

export interface TileCacheStats {
  files: number
  bytes: number
}

export interface GeoPosition {
  longitude: number
  latitude: number
  height: number
}

export interface StoredShape {
  id: string
  kind: 'point' | 'polyline' | 'polygon'
  positions: GeoPosition[]
  annotation: string
  createdAt: number
}

export type AiProtocol = 'openai' | 'anthropic'
export type AiThinkingLevel = 'low' | 'medium' | 'high'

export interface AiModelConfig {
  id: string
  label: string
  contextWindow: number
  streaming: boolean
  vision: boolean
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

export interface AiSearchProviderConfig {
  id: string
  name: string
  kind: 'baidu'
}

export interface AiSearchReference {
  title: string
  url: string
  content: string
  website: string
  date: string
}

export interface AiSettings {
  providers: AiProviderConfig[]
  activeProviderId: string
  activeModelId: string
  searchProviders: AiSearchProviderConfig[]
  activeSearchProviderId: string
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
  | { sessionId: string; type: 'tool-end'; callId: string; ok: boolean; summary: string; result: string; references?: AiSearchReference[] }
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

export interface EarthquakeEvent {
  magnitude: number
  longitude: number
  latitude: number
  depthKm: number
  place: string
  time: number
}

export interface EarthquakeFeed {
  fetchedAt: number
  events: EarthquakeEvent[]
}

export type PlaceSearchProvider = 'amap' | 'baidu'

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
  annotations: {
    list: (): Promise<StoredShape[]> => ipcRenderer.invoke('annotations:list'),
    save: (shape: StoredShape): Promise<void> => ipcRenderer.invoke('annotations:save', shape),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('annotations:remove', id)
  },
  places: {
    search: (keyword: string, provider?: PlaceSearchProvider): Promise<PlaceSearchResult> => ipcRenderer.invoke('places:search', keyword, provider)
  },
  datasets: {
    getEarthquakes: (): Promise<EarthquakeFeed> => ipcRenderer.invoke('datasets:earthquakes')
  },
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
