import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { useGlobeStore } from '@renderer/stores/globe'

interface LayerProvider {
  createImageryProvider: () => Cesium.ImageryProvider | Promise<Cesium.ImageryProvider>
}

const layerRegistry: Record<string, LayerProvider> = {
  osm: {
    createImageryProvider: () => new Cesium.UrlTemplateImageryProvider({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', credit: '© OpenStreetMap contributors' })
  },
  'esri-imagery': {
    createImageryProvider: () => Cesium.ArcGisMapServerImageryProvider.fromUrl('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer', { credit: '© Esri' })
  },
  opentopomap: {
    createImageryProvider: () => new Cesium.UrlTemplateImageryProvider({ url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', subdomains: ['a', 'b', 'c'], credit: '© OpenTopoMap contributors' })
  }
}

function normalizeHeading(radians: number): number {
  const degrees = Cesium.Math.toDegrees(radians) % 360
  return degrees < 0 ? degrees + 360 : degrees
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
    store.setCameraReadout({
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height,
      heading: normalizeHeading(camera.heading),
      pitch: Cesium.Math.toDegrees(camera.pitch)
    })
  }

  function layerMeta(id: string) {
    return store.layers.find((layer) => layer.id === id)
  }

  async function addLayer(id: string, expectedGeneration: number): Promise<boolean> {
    const provider = layerRegistry[id]
    if (!viewer.value || !provider || imageryLayers.has(id)) return false
    try {
      const imageryProvider = await provider.createImageryProvider()
      const currentViewer = viewer.value
      if (!currentViewer || currentViewer.isDestroyed() || expectedGeneration !== generation) return false
      const layer = currentViewer.imageryLayers.addImageryProvider(imageryProvider)
      layer.show = id === store.selectedLayerId
      layer.alpha = layerMeta(id)?.opacity ?? 1
      imageryLayers.set(id, layer)
      return true
    } catch (error) {
      if (id === store.selectedLayerId) {
        store.setGlobeError(error instanceof Error ? error.message : `${layerMeta(id)?.name ?? id} 加载失败`)
      }
      return false
    }
  }

  function revealBasemap(id: string): void {
    imageryLayers.forEach((layer, layerId) => {
      layer.show = layerId === id
    })
  }

  function switchBasemap(id: string): void {
    if (!layerRegistry[id] || !viewer.value || viewer.value.isDestroyed()) return
    store.selectBasemap(id)
    if (imageryLayers.has(id)) {
      revealBasemap(id)
      return
    }
    void addLayer(id, generation).then((loaded) => {
      if (loaded && store.selectedLayerId === id) revealBasemap(id)
    })
  }

  function setLayerOpacity(id: string, opacity: number): void {
    const value = Math.min(1, Math.max(0, opacity))
    const layer = imageryLayers.get(id)
    if (layer) layer.alpha = value
    store.setLayerOpacity(id, value)
  }

  function flyTo(longitude: number, latitude: number, height: number): void {
    if (!viewer.value || viewer.value.isDestroyed()) return
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90 || height <= 0) return
    viewer.value.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height), duration: 1.2, complete: updateCameraState })
  }

  onMounted(() => {
    if (!container.value) return
    try {
      generation += 1
      viewer.value = new Cesium.Viewer(container.value, { baseLayer: false, baseLayerPicker: false, geocoder: false, animation: false, timeline: false, sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, homeButton: false, infoBox: false, selectionIndicator: false })
      viewer.value.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(105, 35, 15000000) })
      viewer.value.camera.moveEnd.addEventListener(updateCameraState)
      updateCameraState()
      void addLayer(store.selectedLayerId, generation).then((loaded) => {
        if (loaded) store.setGlobeReady(true)
      })
    } catch (error) {
      store.setGlobeError(error instanceof Error ? error.message : '地球初始化失败')
    }
  })

  onBeforeUnmount(() => {
    generation += 1
    const currentViewer = viewer.value
    if (!currentViewer || currentViewer.isDestroyed()) return
    currentViewer.camera.moveEnd.removeEventListener(updateCameraState)
    currentViewer.destroy()
    viewer.value = undefined
    imageryLayers.clear()
  })

  return { viewer, switchBasemap, setLayerOpacity, flyTo }
}
