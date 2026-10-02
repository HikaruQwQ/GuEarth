import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { useGlobeStore, providerCatalog, terrainCatalog, type ProviderMeta } from '@renderer/stores/globe'

interface LayerProvider {
  meta: ProviderMeta
  createImageryProvider: (styleId: string) => Promise<Cesium.ImageryProvider>
}

const protocolTileUrl = (id: string, styleId: string): string => `guearth-tile://${id}/${styleId}/{z}/{x}/{y}`
const providerMeta = (id: string): ProviderMeta => providerCatalog.find((provider) => provider.id === id) ?? providerCatalog[0]

const layerRegistry: Record<string, LayerProvider> = {
  osm: { meta: providerMeta('osm'), createImageryProvider: async () => new Cesium.UrlTemplateImageryProvider({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', credit: '© OpenStreetMap contributors' }) },
  'esri-imagery': { meta: providerMeta('esri-imagery'), createImageryProvider: async () => Cesium.ArcGisMapServerImageryProvider.fromUrl('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer', { credit: '© Esri' }) },
  opentopomap: { meta: providerMeta('opentopomap'), createImageryProvider: async () => new Cesium.UrlTemplateImageryProvider({ url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', subdomains: ['a', 'b', 'c'], credit: '© OpenTopoMap contributors' }) },
  amap: { meta: providerMeta('amap'), createImageryProvider: async (styleId) => new Cesium.UrlTemplateImageryProvider({ url: protocolTileUrl('amap', styleId), credit: '© 高德地图' }) },
  baidu: { meta: providerMeta('baidu'), createImageryProvider: async (styleId) => new Cesium.UrlTemplateImageryProvider({ url: protocolTileUrl('baidu', styleId), credit: '© 百度地图' }) },
  tianditu: {
    meta: providerMeta('tianditu'),
    createImageryProvider: async (styleId) => new Cesium.UrlTemplateImageryProvider({
      url: protocolTileUrl('tianditu', styleId),
      credit: '© 天地图',
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      minimumLevel: 0,
      maximumLevel: 18
    })
  }
}

const terrainRegistry: Record<string, () => Promise<Cesium.TerrainProvider>> = {
  ellipsoid: async () => new Cesium.EllipsoidTerrainProvider(),
  'arcgis-terrain': () => Cesium.ArcGISTiledElevationTerrainProvider.fromUrl('https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer'),
  'mapbox-terrain': () => Cesium.CesiumTerrainProvider.fromUrl(Cesium.IonResource.fromAssetId(1), { requestVertexNormals: true })
}

const terrainName = (id: string): string => terrainCatalog.find((terrain) => terrain.id === id)?.name ?? id

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
      imageryProvider.errorEvent.addEventListener((error) => {
        if (id !== store.selectedLayerId) return
        const message = typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : `${provider.meta.name} 瓦片请求失败`
        store.setGlobeError(message)
      })
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
    const create = terrainRegistry[id] ?? terrainRegistry.ellipsoid
    try {
      const terrain = await create()
      if (!viewer.value || viewer.value.isDestroyed() || expectedGeneration !== generation) return
      viewer.value.terrainProvider = terrain
      store.setTerrainError('')
    } catch (error) {
      store.setTerrainError(error instanceof Error ? error.message : `${terrainName(id)} 加载失败`)
      if (id !== 'ellipsoid') {
        const fallback = await terrainRegistry.ellipsoid()
        if (viewer.value && !viewer.value.isDestroyed() && expectedGeneration === generation) viewer.value.terrainProvider = fallback
      }
    }
  }

  function applyTerrainRendering(): void {
    const currentViewer = viewer.value
    if (!currentViewer || currentViewer.isDestroyed()) return
    currentViewer.scene.verticalExaggeration = store.terrainExaggeration
    currentViewer.scene.globe.enableLighting = store.terrainLighting
    currentViewer.scene.globe.depthTestAgainstTerrain = true
  }

  function syncAutoProvider(): void {
    if (store.selectionMode !== 'auto') return
    const target = isMainland(store.camera.longitude, store.camera.latitude) ? store.chinaProviderId : store.globalProviderId
    if (target !== store.selectedLayerId) switchBasemap(target, false)
  }

  function toggleLevelView(): void {
    if (!viewer.value || viewer.value.isDestroyed()) return
    const currentViewer = viewer.value
    const camera = currentViewer.camera
    const cartographic = camera.positionCartographic
    const longitude = Cesium.Math.toDegrees(cartographic.longitude)
    const latitude = Cesium.Math.toDegrees(cartographic.latitude)
    const activate = !store.levelViewActive
    store.setLevelViewActive(activate)
    const height = activate ? Math.min(Math.max(cartographic.height * 0.35, 15000), 120000) : Math.min(Math.max(cartographic.height * 2, 40000), 4000000)
    const pitch = activate ? -12 : -45
    const flyToOrientation = () => {
      if (currentViewer.isDestroyed()) return
      currentViewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
        orientation: {
          heading: camera.heading,
          pitch: Cesium.Math.toRadians(pitch),
          roll: 0.0
        },
        duration: 1.2,
        complete: updateCameraState
      })
    }
    if (currentViewer.scene.mode !== Cesium.SceneMode.SCENE3D) {
      const morphComplete = () => {
        currentViewer.scene.morphComplete.removeEventListener(morphComplete)
        flyToOrientation()
      }
      currentViewer.scene.morphComplete.addEventListener(morphComplete)
      currentViewer.scene.morphTo3D(1.0)
      store.setSceneMode('3D')
    } else {
      flyToOrientation()
    }
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
        applyTerrainRendering()
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

  return {
    viewer,
    switchBasemap,
    setProviderStyle,
    setLayerOpacity: (id: string, opacity: number) => { const value = Math.min(1, Math.max(0, opacity)); const layer = imageryLayers.get(id); if (layer) layer.alpha = value; store.setLayerOpacity(id, value) },
    flyTo,
    toggleLevelView,
    setTerrain: (id: string) => { store.setTerrainProvider(id); void setTerrain(id, generation) },
    setTerrainExaggeration: (value: number) => { store.setTerrainExaggeration(value); const currentViewer = viewer.value; if (currentViewer && !currentViewer.isDestroyed()) currentViewer.scene.verticalExaggeration = store.terrainExaggeration },
    setTerrainLighting: (value: boolean) => { store.setTerrainLighting(value); const currentViewer = viewer.value; if (currentViewer && !currentViewer.isDestroyed()) currentViewer.scene.globe.enableLighting = value }
  }
}
