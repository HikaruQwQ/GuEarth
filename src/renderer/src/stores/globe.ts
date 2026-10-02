import { ref } from 'vue'
import { defineStore } from 'pinia'

export type LayerKind = 'basemap' | 'overlay'

export interface LayerMeta {
  id: string
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

const defaultLayers: LayerMeta[] = [
  { id: 'osm', name: 'OpenStreetMap', description: '道路与地名', kind: 'basemap', opacity: 1 },
  { id: 'esri-imagery', name: 'Esri World Imagery', description: '卫星影像', kind: 'basemap', opacity: 1 },
  { id: 'opentopomap', name: 'OpenTopoMap', description: '地形晕渲', kind: 'basemap', opacity: 1 }
]

export const useGlobeStore = defineStore('globe', () => {
  const layers = ref<LayerMeta[]>(defaultLayers.map((layer) => ({ ...layer })))
  const selectedLayerId = ref('osm')
  const isLayerPanelOpen = ref(false)
  const isGlobeReady = ref(false)
  const globeError = ref('')
  const camera = ref<CameraReadout>({ longitude: 105, latitude: 35, height: 15000000, heading: 0, pitch: 0 })

  function setLayerPanelOpen(value: boolean): void {
    isLayerPanelOpen.value = value
  }

  function setGlobeReady(value: boolean): void {
    isGlobeReady.value = value
    if (value) globeError.value = ''
  }

  function setGlobeError(message: string): void {
    globeError.value = message
    isGlobeReady.value = false
  }

  function setCameraReadout(value: CameraReadout): void {
    camera.value = value
  }

  function selectBasemap(id: string): void {
    selectedLayerId.value = id
  }

  function setLayerOpacity(id: string, opacity: number): void {
    layers.value = layers.value.map((layer) => (layer.id === id ? { ...layer, opacity } : layer))
  }

  return { layers, selectedLayerId, isLayerPanelOpen, isGlobeReady, globeError, camera, setLayerPanelOpen, setGlobeReady, setGlobeError, setCameraReadout, selectBasemap, setLayerOpacity }
})
