import { ref } from 'vue'
import { defineStore } from 'pinia'

export type LayerKind = 'basemap' | 'overlay'
export type ProviderRegion = 'global' | 'china'
export type SelectionMode = 'manual' | 'auto'

export interface ProviderStyle {
  id: string
  name: string
}

export interface ProviderMeta {
  id: string
  name: string
  description: string
  region: ProviderRegion
  coordinateSystem: 'WGS84' | 'GCJ02' | 'BD09'
  requiresKey: boolean
  requiresSk?: boolean
  skOptional?: boolean
  requiresSecurityKey?: boolean
  securityKeyOptional?: boolean
  styles: ProviderStyle[]
  defaultStyleId: string
}

export interface LayerMeta {
  id: string
  providerId: string
  name: string
  description: string
  kind: LayerKind
  opacity: number
}

export interface CameraReadout {
  longitude: number
  latitude: number
  height: number
  heading: number
  pitch: number
}

export type SceneMode = '2D' | '3D'

export const providerCatalog: ProviderMeta[] = [
  { id: 'osm', name: 'OpenStreetMap', description: '道路与地名', region: 'global', coordinateSystem: 'WGS84', requiresKey: false, styles: [{ id: 'standard', name: '标准' }], defaultStyleId: 'standard' },
  { id: 'esri-imagery', name: 'Esri', description: '卫星影像', region: 'global', coordinateSystem: 'WGS84', requiresKey: false, styles: [{ id: 'satellite', name: '卫星' }], defaultStyleId: 'satellite' },
  { id: 'opentopomap', name: 'OpenTopoMap', description: '地形晕渲', region: 'global', coordinateSystem: 'WGS84', requiresKey: false, styles: [{ id: 'topo', name: '地形' }], defaultStyleId: 'topo' },
  { id: 'tianditu', name: '天地图', description: '大陆地图', region: 'china', coordinateSystem: 'WGS84', requiresKey: true, styles: [{ id: 'road', name: '道路' }, { id: 'satellite', name: '卫星' }], defaultStyleId: 'road' }
]

export const credentialOnlyProviders: ProviderMeta[] = [
  { id: 'amap', name: '高德', description: '大陆地图', region: 'china', coordinateSystem: 'GCJ02', requiresKey: true, requiresSecurityKey: true, styles: [{ id: 'road', name: '道路' }, { id: 'satellite', name: '卫星' }], defaultStyleId: 'road' },
  { id: 'baidu', name: '百度', description: '大陆地图', region: 'china', coordinateSystem: 'BD09', requiresKey: true, requiresSk: true, skOptional: true, styles: [{ id: 'road', name: '道路' }, { id: 'satellite', name: '卫星' }], defaultStyleId: 'road' }
]

const defaultLayers: LayerMeta[] = providerCatalog.map((provider) => ({
  id: provider.id,
  providerId: provider.id,
  name: provider.name,
  description: provider.description,
  kind: 'basemap',
  opacity: 1
}))

const terrainProviderIds = new Set(['ellipsoid', 'arcgis-terrain', 'mapbox-terrain'])

function providerFor(id: string): ProviderMeta | undefined {
  return providerCatalog.find((provider) => provider.id === id) || credentialOnlyProviders.find((provider) => provider.id === id)
}

function providerInRegion(id: string, region: ProviderRegion): boolean {
  return providerFor(id)?.region === region
}

function styleFor(providerId: string, styleId: string): string {
  const provider = providerFor(providerId)
  return provider?.styles.some((style) => style.id === styleId) ? styleId : provider?.defaultStyleId ?? 'standard'
}

function apiAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.guEarth?.settings)
}

export const useGlobeStore = defineStore('globe', () => {
  const layers = ref<LayerMeta[]>(defaultLayers.map((layer) => ({ ...layer })))
  const selectedLayerId = ref('osm')
  const selectionMode = ref<SelectionMode>('manual')
  const chinaProviderId = ref('tianditu')
  const globalProviderId = ref('osm')
  const providerStyles = ref<Record<string, string>>(Object.fromEntries(providerCatalog.map((provider) => [provider.id, provider.defaultStyleId])))
  const terrainProviderId = ref('ellipsoid')
  const tileCacheEnabled = ref(true)
  const providerCredentials = ref<Record<string, { configured: boolean; updatedAt: number | null }>>({})
  const isLayerPanelOpen = ref(false)
  const isGlobeReady = ref(false)
  const globeError = ref('')
  const terrainError = ref('')
  const camera = ref<CameraReadout>({ longitude: 105, latitude: 35, height: 15000000, heading: 0, pitch: 0 })
  const sceneMode = ref<SceneMode>('3D')

  async function hydrateSettings(): Promise<void> {
    if (!apiAvailable()) return
    try {
      const settings = await window.guEarth.settings.get()
      selectedLayerId.value = providerFor(settings.selectedImageryProviderId) ? settings.selectedImageryProviderId : 'osm'
      terrainProviderId.value = terrainProviderIds.has(settings.selectedTerrainProviderId) ? settings.selectedTerrainProviderId : 'ellipsoid'
      tileCacheEnabled.value = settings.tileCacheEnabled
      selectionMode.value = settings.selectionMode
      chinaProviderId.value = providerInRegion(settings.chinaProviderId, 'china') ? settings.chinaProviderId : 'tianditu'
      globalProviderId.value = providerInRegion(settings.globalProviderId, 'global') ? settings.globalProviderId : 'osm'
      providerStyles.value = Object.fromEntries(providerCatalog.map((provider) => [provider.id, styleFor(provider.id, settings.providerStyles?.[provider.id] ?? provider.defaultStyleId)]))
      providerCredentials.value = settings.providerCredentials
      sceneMode.value = settings.sceneMode ?? '3D'
    } catch {
      globeError.value = '设置读取失败'
    }
  }

  async function persistSettings(): Promise<void> {
    if (!apiAvailable()) return
    await window.guEarth.settings.update({
      selectedImageryProviderId: selectedLayerId.value,
      selectedTerrainProviderId: terrainProviderId.value,
      tileCacheEnabled: tileCacheEnabled.value,
      selectionMode: selectionMode.value,
      chinaProviderId: chinaProviderId.value,
      globalProviderId: globalProviderId.value,
      providerStyles: providerStyles.value,
      sceneMode: sceneMode.value
    })
  }

  function setLayerPanelOpen(value: boolean): void { isLayerPanelOpen.value = value }
  function setGlobeReady(value: boolean): void { isGlobeReady.value = value; if (value) globeError.value = '' }
  function setGlobeError(message: string): void { globeError.value = message }
  function setTerrainError(message: string): void { terrainError.value = message }
  function setCameraReadout(value: CameraReadout): void { camera.value = value }
  function selectBasemap(id: string): void { selectedLayerId.value = id; void persistSettings() }
  function setLayerOpacity(id: string, opacity: number): void { layers.value = layers.value.map((layer) => (layer.id === id ? { ...layer, opacity } : layer)) }
  function setSelectionMode(value: SelectionMode): void { selectionMode.value = value; void persistSettings() }
  function setRegionProviders(china: string, global: string): void {
    if (providerInRegion(china, 'china')) chinaProviderId.value = china
    if (providerInRegion(global, 'global')) globalProviderId.value = global
    void persistSettings()
  }
  function setProviderStyle(providerId: string, styleId: string): void {
    const normalized = styleFor(providerId, styleId)
    if (!providerFor(providerId)) return
    providerStyles.value = { ...providerStyles.value, [providerId]: normalized }
    void persistSettings()
  }
  function setTerrainProvider(id: string): void { if (terrainProviderIds.has(id)) terrainProviderId.value = id; void persistSettings() }
  function setTileCacheEnabled(value: boolean): void { tileCacheEnabled.value = value; void persistSettings() }
  function setCredentialStatus(id: string, status: { configured: boolean; updatedAt: number | null }): void { providerCredentials.value = { ...providerCredentials.value, [id]: status } }
  function setSceneMode(mode: SceneMode): void { sceneMode.value = mode; void persistSettings() }

  return {
    layers, selectedLayerId, selectionMode, chinaProviderId, globalProviderId, providerStyles, terrainProviderId, tileCacheEnabled,
    providerCredentials, isLayerPanelOpen, isGlobeReady, globeError, terrainError, camera, sceneMode, hydrateSettings,
    setLayerPanelOpen, setGlobeReady, setGlobeError, setTerrainError, setCameraReadout, selectBasemap, setLayerOpacity,
    setSelectionMode, setRegionProviders, setProviderStyle, setTerrainProvider, setTileCacheEnabled, setCredentialStatus, setSceneMode
  }
})
