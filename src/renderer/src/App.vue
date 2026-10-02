<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useGlobeStore } from '@renderer/stores/globe'
import { useAiStore } from '@renderer/stores/ai'
import { useTerrainLabStore } from '@renderer/stores/terrainLab'
import { useMonsoonStore } from '@renderer/stores/monsoon'
import { useSolarStore } from '@renderer/stores/solar'
import { useTectonicStore } from '@renderer/stores/tectonic'
import { useLabStore } from '@renderer/stores/lab'
import { useDrawStore } from '@renderer/stores/draw'
import { useTeachingStore } from '@renderer/stores/teaching'
import { useCesiumViewer } from '@renderer/composables/useCesiumViewer'
import { useDrawLayer } from '@renderer/composables/useDrawLayer'
import { useRegionTerrain } from '@renderer/composables/useRegionTerrain'
import { useMonsoonLayer } from '@renderer/composables/useMonsoonLayer'
import { usePressureWindLayer } from '@renderer/composables/usePressureWindLayer'
import { useSolarLayer } from '@renderer/composables/useSolarLayer'
import { useTectonicLayer } from '@renderer/composables/useTectonicLayer'
import { useTyphoonMarker } from '@renderer/composables/useTyphoonMarker'
import { useScaleBar } from '@renderer/composables/useScaleBar'
import { climateRegionAt, latitudeZoneName } from '@renderer/utils/climateData'
import { findTeachingLayer } from '@renderer/teaching/registry'
import '@renderer/teaching'
import GlobeToolbar from '@renderer/components/GlobeToolbar.vue'
import CameraStatus from '@renderer/components/CameraStatus.vue'
import LayerPanel from '@renderer/components/LayerPanel.vue'
import LevelViewSwitcher from '@renderer/components/LevelViewSwitcher.vue'
import PlaceSearchBox from '@renderer/components/PlaceSearchBox.vue'
import EoqAssistant from '@renderer/components/EoqAssistant.vue'
import AiSettingsModal from '@renderer/components/AiSettingsModal.vue'
import LegendBar from '@renderer/components/LegendBar.vue'
import ExportPanel from '@renderer/components/ExportPanel.vue'
import DrawPanel from '@renderer/components/DrawPanel.vue'
import LabPanel from '@renderer/components/LabPanel.vue'

const store = useGlobeStore()
const terrainLabStore = useTerrainLabStore()
const monsoonStore = useMonsoonStore()
const solarStore = useSolarStore()
const tectonicStore = useTectonicStore()
const labStore = useLabStore()
const drawStore = useDrawStore()
const aiStore = useAiStore()
const teachingStore = useTeachingStore()
const {
  isLayerPanelOpen,
  layers,
  selectedLayerId,
  globeError,
  terrainError,
  isGlobeReady,
  camera,
  levelViewActive,
  terrainProviderId,
  terrainExaggeration,
  terrainLighting,
  tileCacheEnabled,
  providerCredentials
} =
  storeToRefs(store)

const globeContainer = ref<HTMLDivElement>()
const { viewer, switchBasemap, setLayerOpacity, flyTo, flyToPlace, toggleLevelView, setTerrain, setTerrainExaggeration, setTerrainLighting } = useCesiumViewer(globeContainer)
const { scale: scaleBarReadout } = useScaleBar(viewer)
const exportOpen = ref(false)
const levelSwitcherVisible = computed(() => isGlobeReady.value && camera.value.height < 5000000)
const regionTerrain = useRegionTerrain(viewer)
useMonsoonLayer(viewer)
usePressureWindLayer(viewer)
useSolarLayer(viewer)
useTectonicLayer(viewer)
useTyphoonMarker(viewer)
useDrawLayer(viewer)
teachingStore.bindViewer(viewer)
teachingStore.refreshDefinitions()
drawStore.registerFly(flyTo)
tectonicStore.registerFly(flyTo)
terrainLabStore.registerLab(regionTerrain)

const toolbarPanels = computed(() => {
  const active: string[] = []
  if (isLayerPanelOpen.value) active.push('layers')
  if (drawStore.panelOpen) active.push('annotations')
  if (labStore.panelOpen) active.push('lab')
  if (exportOpen.value) active.push('export')
  if (aiStore.isPanelOpen) active.push('assistant')
  return active
})

function currentViewBounds() {
  const currentViewer = viewer.value
  if (!currentViewer || currentViewer.isDestroyed()) return null
  const rectangle = currentViewer.camera.computeViewRectangle()
  if (!rectangle) return null
  return {
    west: Cesium.Math.toDegrees(rectangle.west),
    south: Cesium.Math.toDegrees(rectangle.south),
    east: Cesium.Math.toDegrees(rectangle.east),
    north: Cesium.Math.toDegrees(rectangle.north)
  }
}

aiStore.registerTool({
  definition: {
    name: 'fly_to',
    description: '将地球视角飞行到指定 WGS-84 经纬度坐标处，用于向用户展示地点或地貌。',
    parameters: {
      type: 'object',
      properties: {
        longitude: { type: 'number', description: '经度（WGS-84，-180 到 180）' },
        latitude: { type: 'number', description: '纬度（WGS-84，-90 到 90）' },
        height: { type: 'number', description: '视点高度（米），省略时为 60000' }
      },
      required: ['longitude', 'latitude']
    }
  },
  execute: async (args) => {
    const longitude = Number(args.longitude)
    const latitude = Number(args.latitude)
    const height = args.height === undefined ? 60000 : Number(args.height)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return { error: '坐标无效，需要 WGS-84 经纬度' }
    if (!Number.isFinite(height) || height <= 0 || height > 20000000) return { error: '视点高度无效' }
    flyTo(longitude, latitude, height)
    return { status: 'ok', message: `视角已飞往 ${longitude.toFixed(4)}, ${latitude.toFixed(4)}`, longitude, latitude, height }
  }
})

aiStore.registerTool({
  definition: {
    name: 'query_terrain',
    description: '查询某 WGS-84 经纬度位置的地表海拔（米，椭球高）。用于讲解地形、山脉高度等。',
    parameters: {
      type: 'object',
      properties: {
        longitude: { type: 'number', description: '经度（WGS-84）' },
        latitude: { type: 'number', description: '纬度（WGS-84）' }
      },
      required: ['longitude', 'latitude']
    }
  },
  execute: async (args) => {
    const current = viewer.value
    if (!current || current.isDestroyed()) return { error: '地球尚未就绪' }
    const longitude = Number(args.longitude)
    const latitude = Number(args.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return { error: '坐标无效' }
    const cartographic = Cesium.Cartographic.fromDegrees(longitude, latitude)
    try {
      const [sampled] = await Cesium.sampleTerrainMostDetailed(current.terrainProvider, [cartographic.clone()])
      if (sampled && Number.isFinite(sampled.height)) return { height: Math.round(sampled.height * 100) / 100, unit: '米（WGS-84 椭球高）', longitude, latitude }
    } catch {
      void 0
    }
    const fallback = current.scene.globe.getHeight(cartographic)
    return typeof fallback === 'number' && Number.isFinite(fallback)
      ? { height: Math.round(fallback * 100) / 100, unit: '米（已加载地形近似值）', longitude, latitude }
      : { error: '该位置地形数据暂不可用，可稍后重试或先用 fly_to 飞往附近再查询' }
  }
})

aiStore.registerTool({
  definition: {
    name: 'get_camera',
    description: '获取当前地球视角：中心点经纬度、视点高度、朝向与俯仰角。用于回答“我现在看到的是哪里”。',
    parameters: { type: 'object', properties: {} }
  },
  execute: async () => ({
    longitude: Math.round(camera.value.longitude * 10000) / 10000,
    latitude: Math.round(camera.value.latitude * 10000) / 10000,
    height: Math.round(camera.value.height),
    heading: Math.round(camera.value.heading * 10) / 10,
    pitch: Math.round(camera.value.pitch * 10) / 10
  })
})

aiStore.registerTool({
  definition: {
    name: 'find_peaks',
    description: '在当前视野范围内检索山峰与火山（名称与海拔，按海拔降序）。需先把视野缩放到具体区域（范围过大会报错）。用于地貌选点、找最高峰、对比区域最高点等。',
    parameters: {
      type: 'object',
      properties: {
        minElevation: { type: 'number', description: '可选，最低海拔（米），默认 0' }
      }
    }
  },
  execute: async (args) => {
    const bounds = currentViewBounds()
    if (!bounds) return { error: '地球尚未就绪，无法读取视野范围' }
    const minElevation = args.minElevation === undefined ? 0 : Number(args.minElevation)
    if (!Number.isFinite(minElevation)) return { error: 'minElevation 参数无效' }
    try {
      const peaks = await window.guEarth.places.peaks(bounds, minElevation)
      return { count: peaks.length, peaks }
    } catch (error) {
      return { error: error instanceof Error ? error.message : '地貌检索失败' }
    }
  }
})

aiStore.registerTool({
  definition: {
    name: 'set_month',
    description: '设置季风气候实验室的月份时间轴（1-12），同步演示季风风向、洋流、气压带风带与雨带的季节变化。',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'number', description: '月份，1 到 12' }
      },
      required: ['month']
    }
  },
  execute: async (args) => {
    const month = Math.round(Number(args.month))
    if (!Number.isFinite(month) || month < 1 || month > 12) return { error: 'month 参数无效，需要 1-12 的整数' }
    monsoonStore.setMonth(month)
    labStore.openTab('monsoon')
    return { status: 'ok', month, message: `季风气候实验室已切换到 ${month} 月` }
  }
})

aiStore.registerTool({
  definition: {
    name: 'open_layer',
    description: '打开或关闭教学专题图层，并可自动飞到该图层区域。可用图层包括：经纬网、九大商品粮基地、南水北调、西气东输、西电东送通道、石油进口海上通道、中国主要核电站、主要梯级水电站、资源型城市案例、历史台风路径等。讲解资源配置、产业布局、能源安全等话题时优先用它配合讲解。',
    parameters: {
      type: 'object',
      properties: {
        layer: { type: 'string', description: '图层 id 或中文名称' },
        visible: { type: 'boolean', description: 'true 开启（默认），false 关闭' }
      },
      required: ['layer']
    }
  },
  execute: async (args) => {
    const key = String(args.layer ?? '')
    const definition = findTeachingLayer(key)
    if (!definition) {
      return { error: '未找到该图层', available: teachingStore.definitions.map((item) => ({ id: item.id, name: item.name })) }
    }
    const visible = args.visible === undefined ? true : args.visible === true
    teachingStore.setLayerVisible(definition.id, visible)
    if (visible && definition.flyTo) flyTo(definition.flyTo.longitude, definition.flyTo.latitude, definition.flyTo.height)
    return { status: 'ok', layer: definition.id, name: definition.name, visible }
  }
})

aiStore.registerTool({
  definition: {
    name: 'explain_climate',
    description: '获取某 WGS-84 坐标的气候背景：所属气候区（柯本分类）、纬度带、海拔与当前演示月份。回答气候成因、解释降水分布或比较两地气候前应先调用。',
    parameters: {
      type: 'object',
      properties: {
        longitude: { type: 'number', description: '经度，-180 到 180' },
        latitude: { type: 'number', description: '纬度，-90 到 90' }
      },
      required: ['longitude', 'latitude']
    }
  },
  execute: async (args) => {
    const longitude = Number(args.longitude)
    const latitude = Number(args.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return { error: '坐标无效' }
    const region = climateRegionAt(longitude, latitude)
    const current = viewer.value
    const elevation = current && !current.isDestroyed()
      ? current.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(longitude, latitude))
      : undefined
    return {
      longitude,
      latitude,
      latitudeZone: latitudeZoneName(latitude),
      climateRegion: region ? `${region.name}（柯本 ${region.koppen}）` : '未收录的典型气候区，请按纬度带和海陆位置推断',
      elevationMeters: typeof elevation === 'number' && Number.isFinite(elevation) ? Math.round(elevation) : '未知',
      currentDemoMonth: monsoonStore.month
    }
  }
})

function handleToolbarOpen(id: string): void {
  if (id === 'layers') handleOpenLayers()
  else if (id === 'annotations') handleOpenAnnotations()
  else if (id === 'lab') handleOpenLab()
  else if (id === 'export') handleOpenExport()
  else if (id === 'assistant') handleOpenAssistant()
}

function closeLeftPanels(): void {
  drawStore.setPanelOpen(false)
  labStore.setPanelOpen(false)
}

function handleOpenLayers(): void {
  aiStore.setPanelOpen(false)
  store.setLayerPanelOpen(true)
}

function handleOpenAnnotations(): void {
  labStore.setPanelOpen(false)
  drawStore.setPanelOpen(true)
}

function handleOpenLab(): void {
  drawStore.setPanelOpen(false)
  labStore.setPanelOpen(true)
}

function handleOpenExport(): void {
  exportOpen.value = true
}

function handleOpenAssistant(): void {
  store.setLayerPanelOpen(false)
  aiStore.setPanelOpen(true)
}

function handleClosePanel(): void {
  store.setLayerPanelOpen(false)
}

function handleSelectLayer(id: string): void {
  switchBasemap(id)
}

function handleOpacityChange(id: string, opacity: number): void {
  setLayerOpacity(id, opacity)
}

function handleTerrainChange(id: string): void {
  setTerrain(id)
}

function handleTerrainExaggeration(value: number): void {
  setTerrainExaggeration(value)
}

function handleTerrainLighting(value: boolean): void {
  setTerrainLighting(value)
}

function handleCacheChange(value: boolean): void {
  store.setTileCacheEnabled(value)
}

async function handleCredentialSave(id: string, apiKey: string, securityKey?: string): Promise<void> {
  try {
    const status = await window.guEarth.settings.setProviderApiKey(id, apiKey)
    store.setCredentialStatus(id, status)
    if (securityKey) {
      const securityStatus = await window.guEarth.settings.setProviderApiKey(`${id}-sk`, securityKey)
      store.setCredentialStatus(`${id}-sk`, securityStatus)
    } else if (id === 'amap') {
      const securityStatus = await window.guEarth.settings.clearProviderApiKey(`${id}-sk`)
      store.setCredentialStatus(`${id}-sk`, securityStatus)
    }
  } catch {
    store.setGlobeError('密钥保存失败')
  }
}

async function handleCredentialClear(id: string): Promise<void> {
  try {
    const status = await window.guEarth.settings.clearProviderApiKey(id)
    store.setCredentialStatus(id, status)
    const securityStatus = await window.guEarth.settings.clearProviderApiKey(`${id}-sk`)
    store.setCredentialStatus(`${id}-sk`, securityStatus)
  } catch {
    store.setGlobeError('密钥清除失败')
  }
}

function handleHome(): void {
  flyTo(105, 35, 15000000)
}

function handleRetry(): void {
  location.reload()
}

function handleLevelViewToggle(): void {
  toggleLevelView()
}

async function handleDrop(event: DragEvent): Promise<void> {
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  if (!/\.(kml|kmz|gpx)$/i.test(file.name)) return
  const filePath = window.guEarth.pathForFile(file)
  if (!filePath) return
  closeLeftPanels()
  drawStore.setPanelOpen(true)
  try {
    await drawStore.importFromPath(filePath)
  } catch (cause) {
    store.setGlobeError(cause instanceof Error ? cause.message : '导入失败')
  }
}
</script>

<template>
  <div class="app" @dragover.prevent @drop.prevent="handleDrop">
    <div ref="globeContainer" class="globe"></div>
    <GlobeToolbar
      :active-panels="toolbarPanels"
      @open="handleToolbarOpen"
      @home="handleHome"
    />
    <PlaceSearchBox @select="flyToPlace" />
    <LegendBar />
    <CameraStatus :camera="camera" :scale-bar="scaleBarReadout" />
    <EoqAssistant />
    <AiSettingsModal />
    <LevelViewSwitcher
      :level-view-active="levelViewActive"
      :visible="levelSwitcherVisible"
      @toggle="handleLevelViewToggle"
    />
    <ExportPanel
      :resolve-viewer="() => viewer"
      :scale-bar="scaleBarReadout"
      :heading="camera.heading"
      :open="exportOpen"
      @close="exportOpen = false"
    />
    <LayerPanel
      :open="isLayerPanelOpen"
      :layers="layers"
      :selected-layer-id="selectedLayerId"
      :error="globeError"
      :terrain-error="terrainError"
      :loading="!isGlobeReady"
      :terrain-provider-id="terrainProviderId"
      :terrain-exaggeration="terrainExaggeration"
      :terrain-lighting="terrainLighting"
      :tile-cache-enabled="tileCacheEnabled"
      :provider-credentials="providerCredentials"
      @close="handleClosePanel"
      @select="handleSelectLayer"
      @opacity="handleOpacityChange"
      @retry="handleRetry"
      @terrain="handleTerrainChange"
      @terrain-exaggeration="handleTerrainExaggeration"
      @terrain-lighting="handleTerrainLighting"
      @cache="handleCacheChange"
      @credential-save="handleCredentialSave"
      @credential-clear="handleCredentialClear"
    />
    <DrawPanel />
    <LabPanel />
  </div>
</template>

<style scoped>
.app {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.globe {
  width: 100%;
  height: 100%;
}
</style>
