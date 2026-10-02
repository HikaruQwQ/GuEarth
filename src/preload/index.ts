import { contextBridge, ipcRenderer } from 'electron'
import type {
  AiChatMessage,
  AiChunkEvent,
  AiConfigInfo,
  AiConfigPatch,
  GeoBounds,
  GuEarthSettings,
  GuEarthSettingsPatch,
  PeakResult,
  PlaceResult,
  ProviderCredentialStatus,
  TileCacheEntry,
  TileCacheStats,
  TileKey
} from './types'

export type {
  AiChatMessage,
  AiChatToolCall,
  AiChunkEvent,
  AiConfigInfo,
  AiConfigPatch,
  GeoBounds,
  GuEarthSettings,
  GuEarthSettingsPatch,
  PeakResult,
  PlaceResult,
  ProviderCredentialStatus,
  TileCacheEntry,
  TileCacheStats,
  TileKey
} from './types'

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
    search: (query: string): Promise<PlaceResult[]> => ipcRenderer.invoke('places:search', query),
    peaks: (bounds: GeoBounds, minElevation?: number): Promise<PeakResult[]> => ipcRenderer.invoke('places:peaks', bounds, minElevation)
  },
  ai: {
    getConfig: (): Promise<AiConfigInfo> => ipcRenderer.invoke('ai:get-config'),
    saveConfig: (patch: AiConfigPatch): Promise<AiConfigInfo> => ipcRenderer.invoke('ai:save-config', patch),
    chat: (requestId: string, messages: AiChatMessage[]): Promise<void> => ipcRenderer.invoke('ai:chat', requestId, messages),
    abort: (requestId: string): Promise<void> => ipcRenderer.invoke('ai:abort', requestId),
    onChunk: (listener: (event: AiChunkEvent) => void): (() => void) => {
      const wrapped = (_event: unknown, payload: AiChunkEvent): void => listener(payload)
      ipcRenderer.on('ai:chunk', wrapped)
      return () => {
        ipcRenderer.removeListener('ai:chunk', wrapped)
      }
    }
  }
}

export type GuEarthApi = typeof api

contextBridge.exposeInMainWorld('guEarth', api)
