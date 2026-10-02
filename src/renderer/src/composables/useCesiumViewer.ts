import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { useGlobeStore, providerCatalog, type ProviderMeta } from '@renderer/stores/globe'

interface LayerProvider {
  meta: ProviderMeta
  createImageryProvider: (styleId: string) => Promise<Cesium.ImageryProvider>
}

interface TerrainProviderDefinition {
  id: string
  name: string
  create: () => Promise<Cesium.TerrainProvider>
}

const protocolTileUrl = (id: string, styleId: string): string => `guearth-tile://${id}/${styleId}/{z}/{x}/{y}`
const providerMeta = (id: string): ProviderMeta => providerCatalog.find((provider) => provider.id === id) ?? providerCatalog[0]

const layerRegistry: Record<string, LayerProvider> = {
  osm: { meta: providerMeta('osm'), createImageryProvider: async () => new Cesium.UrlTemplateImageryProvider({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', credit: '© OpenStreetMap contributors' }) },
  'esri-imagery': { meta: providerMeta('esri-imagery'), createImageryProvider: async () => Cesium.ArcGisMapServerImageryProvider.fromUrl('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer', { credit: '© Esri' }) },
  opentopomap: { meta: providerMeta('opentopomap'), createImageryProvider: async () => new Cesium.UrlTemplateImageryProvider({ url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', subdomains: ['a', 'b', 'c'], credit: '© OpenTopoMap contributors' }) },
  amap: { meta: providerMeta('amap'), createImageryProvider: async (styleId) => new Cesium.UrlTemplateImageryProvider({ url: protocolTileUrl('amap', styleId), credit: '© 高德地图' }) },
  baidu: { meta: providerMeta('baidu'), createImageryProvider: async (styleId) => new Cesium.UrlTemplateImageryProvider({ url: protocolTileUrl('baidu', styleId), credit: '© 百度地图' }) },
  tianditu: { meta: providerMeta('tianditu'), createImageryProvider: async (styleId) => new Cesium.UrlTemplateImageryProvider({ url: protocolTileUrl('tianditu', styleId), credit: '© 天地图' }) }
}

const terrainRegistry: Record<string, TerrainProviderDefinition> = {
  ellipsoid: { id: 'ellipsoid', name: '椭球', create: async () => new Cesium.EllipsoidTerrainProvider() },
  'arcgis-terrain': { id: 'arcgis-terrain', name: 'ArcGIS 地形', create: async () => Cesium.ArcGISTiledElevationTerrainProvider.fromUrl('https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer') },
  'mapbox-terrain': { id: 'mapbox-terrain', name: 'Mapbox 地形', create: async () => Cesium.CesiumTerrainProvider.fromUrl(Cesium.IonResource.fromAssetId(1), { requestVertexNormals: true }) }
}

function normalizeHeading(radians: number): number {
  const degrees = Cesium.Math.toDegrees(radians) % 360
  return degrees < 0 ? degrees + 360 : degrees
}

function isMainland(longitude: number, latitude: number): boolean {
  return longitude >= 73.5 && longitude <= 135.1 && latitude >= 18 && latitude <= 53.6
}

export function useCesiumViewer(container: Ref<HTMLDivElement | undefined>) {
  const viewer = ref<Cesium.Viewer>()
  const imageryLayers = new Map<string, Cesium.ImageryLayer>()
  const store = useGlobeStore()
  let generation = 0

  function updateCameraState(): void {
    const currentViewer = viewer.value
    if (!currentViewer || currentViewer.isDestroyed()) return
    const camera = currentViewer.camera
    const cartographic = camera.positionCartographic
    store.setCameraReadout({ longitude: Cesium.Math.toDegrees(cartographic.longitude), latitude: Cesium.Math.toDegrees(cartographic.latitude), height: cartographic.height, heading: normalizeHeading(camera.heading), pitch: Cesium.Math.toDegrees(camera.pitch) })
  }

  function layerMeta(id: string) { return store.layers.find((layer) => layer.id === id) }

  async function addLayer(id: string, expectedGeneration: number): Promise<boolean> {
    const provider = layerRegistry[id]
    if (!viewer.value || !provider || imageryLayers.has(id)) return false
    if (provider.meta.requiresKey && !store.providerCredentials[id]?.configured) {
      if (id === store.selectedLayerId) store.setGlobeError(`${provider.meta.name} 需要 API Key`)
      return false
    }
    try {
      const imageryProvider = await provider.createImageryProvider(store.providerStyles[id] ?? provider.meta.defaultStyleId)
      const currentViewer = viewer.value
      if (!currentViewer || currentViewer.isDestroyed() || expectedGeneration !== generation) return false
      const layer = currentViewer.imageryLayers.addImageryProvider(imageryProvider)
      layer.show = id === store.selectedLayerId
      layer.alpha = layerMeta(id)?.opacity ?? 1
      imageryLayers.set(id, layer)
      return true
    } catch (error) {
      if (id === store.selectedLayerId) store.setGlobeError(error instanceof Error ? error.message : `${provider.meta.name} 加载失败`)
      return false
    }
  }

  function revealBasemap(id: string): void { imageryLayers.forEach((layer, layerId) => { layer.show = layerId === id }) }

  function switchBasemap(id: string, userInitiated = true): void {
    const provider = layerRegistry[id]
    if (!provider || !viewer.value || viewer.value.isDestroyed()) return
    if (provider.meta.requiresKey && !store.providerCredentials[id]?.configured) {
      store.setGlobeError(`${provider.meta.name} 需要 API Key`)
      return
    }
    if (userInitiated && store.selectionMode === 'auto') store.setSelectionMode('manual')
    store.selectBasemap(id)
    if (imageryLayers.has(id)) { revealBasemap(id); return }
    void addLayer(id, generation).then((loaded) => { if (loaded && store.selectedLayerId === id) revealBasemap(id) })
  }

  function setProviderStyle(id: string, styleId: string): void {
    const provider = layerRegistry[id]
    if (!provider || !provider.meta.styles.some((style) => style.id === styleId)) return
    store.setProviderStyle(id, styleId)
    const layer = imageryLayers.get(id)
    if (layer && viewer.value && !viewer.value.isDestroyed()) {
      generation += 1
      const expectedGeneration = generation
      viewer.value.imageryLayers.remove(layer, true)
      imageryLayers.delete(id)
      if (id === store.selectedLayerId) void addLayer(id, expectedGeneration).then((loaded) => { if (loaded && expectedGeneration === generation) revealBasemap(id) })
    }
  }

  async function setTerrain(id: string, expectedGeneration: number): Promise<void> {
    const definition = terrainRegistry[id] ?? terrainRegistry.ellipsoid
    try {
      const terrain = await definition.create()
      if (!viewer.value || viewer.value.isDestroyed() || expectedGeneration !== generation) return
      viewer.value.terrainProvider = terrain
      store.setTerrainError('')
    } catch (error) {
      store.setTerrainError(error instanceof Error ? error.message : `${definition.name} 加载失败`)
      if (id !== 'ellipsoid') {
        const fallback = await terrainRegistry.ellipsoid.create()
        if (viewer.value && !viewer.value.isDestroyed() && expectedGeneration === generation) viewer.value.terrainProvider = fallback
      }
    }
  }

  function syncAutoProvider(): void {
    if (store.selectionMode !== 'auto') return
    const target = isMainland(store.camera.longitude, store.camera.latitude) ? store.chinaProviderId : store.globalProviderId
    if (target !== store.selectedLayerId) switchBasemap(target, false)
  }

  function switchSceneMode(mode: '2D' | '3D'): void {
    if (!viewer.value || viewer.value.isDestroyed()) return
    const camera = viewer.value.camera
    if (mode === '3D') {
      const cartographic = camera.positionCartographic
      const longitude = Cesium.Math.toDegrees(cartographic.longitude)
      const latitude = Cesium.Math.toDegrees(cartographic.latitude)
      const height = cartographic.height * 1.5
      camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0.0
        },
        duration: 1.0
      })
    } else {
      const cartographic = camera.positionCartographic
      const longitude = Cesium.Math.toDegrees(cartographic.longitude)
      const latitude = Cesium.Math.toDegrees(cartographic.latitude)
      const height = Math.max(cartographic.height * 0.8, 5000)
      camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-90),
          roll: 0.0
        },
        duration: 1.0
      })
    }
    store.setSceneMode(mode)
  }

  function flyTo(longitude: number, latitude: number, height: number): void {
    if (!viewer.value || viewer.value.isDestroyed()) return
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90 || height <= 0) return
    viewer.value.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height), duration: 1.2, complete: updateCameraState })
  }

  onMounted(() => {
    void (async () => {
      if (!container.value) return
      await store.hydrateSettings()
      try {
        generation += 1
        viewer.value = new Cesium.Viewer(container.value, { baseLayer: false, baseLayerPicker: false, terrainProvider: new Cesium.EllipsoidTerrainProvider(), geocoder: false, animation: false, timeline: false, sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, homeButton: false, infoBox: false, selectionIndicator: false })
        viewer.value.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(105, 35, 15000000) })
        const initialMode = store.sceneMode === '2D' ? Cesium.SceneMode.SCENE2D : Cesium.SceneMode.SCENE3D
        viewer.value.scene.mode = initialMode
        viewer.value.camera.moveEnd.addEventListener(updateCameraState)
        viewer.value.camera.moveEnd.addEventListener(syncAutoProvider)
        updateCameraState()
        const initialLayerId = store.selectedLayerId
        void addLayer(initialLayerId, generation).then(async (loaded) => {
          if (loaded) {
            store.setGlobeReady(true)
            return
          }
          if (initialLayerId !== 'osm') {
            store.selectBasemap('osm')
            const fallbackLoaded = await addLayer('osm', generation)
            if (fallbackLoaded) store.setGlobeReady(true)
          }
        })
        void setTerrain(store.terrainProviderId, generation)
      } catch (error) {
        store.setGlobeError(error instanceof Error ? error.message : '地球初始化失败')
      }
    })()
  })

  onBeforeUnmount(() => {
    generation += 1
    const currentViewer = viewer.value
    if (!currentViewer || currentViewer.isDestroyed()) return
    currentViewer.camera.moveEnd.removeEventListener(updateCameraState)
    currentViewer.camera.moveEnd.removeEventListener(syncAutoProvider)
    currentViewer.destroy()
    viewer.value = undefined
    imageryLayers.clear()
  })

  return { viewer, switchBasemap, setProviderStyle, setLayerOpacity: (id: string, opacity: number) => { const value = Math.min(1, Math.max(0, opacity)); const layer = imageryLayers.get(id); if (layer) layer.alpha = value; store.setLayerOpacity(id, value) }, flyTo, setTerrain: (id: string) => { store.setTerrainProvider(id); void setTerrain(id, generation) }, switchSceneMode }
}
