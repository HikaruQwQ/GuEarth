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
  selectionMode: 'manual' | 'auto'
  chinaProviderId: string
  globalProviderId: string
  providerStyles: Record<string, string>
  providerCredentials: Record<string, ProviderCredentialStatus>
  sceneMode: '2D' | '3D'
  aiBaseUrl: string
  aiModel: string
}

export interface GuEarthSettingsPatch {
  selectedImageryProviderId?: string
  selectedTerrainProviderId?: string
  terrainExaggeration?: number
  terrainLighting?: boolean
  tileCacheEnabled?: boolean
  selectionMode?: 'manual' | 'auto'
  chinaProviderId?: string
  globalProviderId?: string
  providerStyles?: Record<string, string>
  sceneMode?: '2D' | '3D'
  aiBaseUrl?: string
  aiModel?: string
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

export interface GeoBounds {
  west: number
  south: number
  east: number
  north: number
}

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

export interface AiChatToolCall {
  id: string
  name: string
  args: string
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: AiChatToolCall[]
}

export type AiChunkEvent =
  | { requestId: string; type: 'text'; value: string }
  | { requestId: string; type: 'end'; content: string; toolCalls: AiChatToolCall[] }
  | { requestId: string; type: 'error'; message: string }

export interface AiConfigInfo {
  configured: boolean
  baseUrl: string
  model: string
}

export interface AiConfigPatch {
  baseUrl?: string
  model?: string
  apiKey?: string
}
