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

export interface GeoBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface PeakResult {
  name: string
  lon: number
  lat: number
  elevation: number
}

export type AnnotationKind = 'point' | 'line' | 'polygon'

export type AnnotationIcon = 'circle' | 'triangle' | 'star' | 'pin'

export interface AnnotationStyle {
  color: string
  lineWidth: number
  fillOpacity: number
  icon: AnnotationIcon
  iconScale: number
}

export interface AnnotationData {
  id: string
  kind: AnnotationKind
  name: string
  points: Array<[number, number]>
  distanceKm: number | null
  areaKm2: number | null
  createdAt: number
  groupId: string | null
  visible: boolean
  style: AnnotationStyle | null
}

export interface AnnotationGroup {
  id: string
  name: string
  createdAt: number
}

export interface GroundOverlayData {
  id: string
  name: string
  assetDir: string | null
  fileName: string | null
  remoteUrl: string | null
  west: number
  south: number
  east: number
  north: number
  opacity: number
  visible: boolean
  createdAt: number
}

export interface AnnotationStoreData {
  groups: AnnotationGroup[]
  annotations: AnnotationData[]
  overlays: GroundOverlayData[]
}

export interface GeoImportAsset {
  href: string
  assetUrl: string
}

export interface GeoImportPayload {
  fileName: string
  format: 'kml' | 'gpx'
  text: string
  assets: GeoImportAsset[]
}

export interface KmlExportAsset {
  assetDir: string
  fileName: string
  zipPath: string
}
