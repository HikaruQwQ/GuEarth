<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Modal } from 'ant-design-vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useGlobeStore } from '@renderer/stores/globe'
import { useDrawingStore, type DrawTool } from '@renderer/stores/drawing'
import { useAiStore } from '@renderer/stores/ai'
import { useTerrainLabStore } from '@renderer/stores/terrainLab'
import { useMonsoonStore } from '@renderer/stores/monsoon'
import { useSolarStore } from '@renderer/stores/solar'
import { useTectonicStore } from '@renderer/stores/tectonic'
import { useCesiumViewer } from '@renderer/composables/useCesiumViewer'
import { useDrawing } from '@renderer/composables/useDrawing'
import { useRegionTerrain } from '@renderer/composables/useRegionTerrain'
import { useMonsoonLayer } from '@renderer/composables/useMonsoonLayer'
import { usePressureWindLayer } from '@renderer/composables/usePressureWindLayer'
import { useSolarLayer } from '@renderer/composables/useSolarLayer'
import { useTectonicLayer } from '@renderer/composables/useTectonicLayer'
import { climateRegionAt, latitudeZoneName } from '@renderer/utils/climateData'
import GlobeToolbar from '@renderer/components/GlobeToolbar.vue'
import CameraStatus from '@renderer/components/CameraStatus.vue'
import LayerPanel from '@renderer/components/LayerPanel.vue'
import LevelViewSwitcher from '@renderer/components/LevelViewSwitcher.vue'
import AnnotationPanel from '@renderer/components/AnnotationPanel.vue'
import PlaceSearchBox from '@renderer/components/PlaceSearchBox.vue'
import EoqAssistant from '@renderer/components/EoqAssistant.vue'
import AiSettingsModal from '@renderer/components/AiSettingsModal.vue'
import TerrainLabPanel from '@renderer/components/TerrainLabPanel.vue'
import MonsoonPanel from '@renderer/components/MonsoonPanel.vue'
import SolarPanel from '@renderer/components/SolarPanel.vue'
import TectonicPanel from '@renderer/components/TectonicPanel.vue'

const store = useGlobeStore()
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
const { flyToShape } = useDrawing(viewer)

const terrainLabStore = useTerrainLabStore()
const monsoonStore = useMonsoonStore()
const solarStore = useSolarStore()
const tectonicStore = useTectonicStore()
const regionTerrain = useRegionTerrain(viewer)
useMonsoonLayer(viewer)
usePressureWindLayer(viewer)
useSolarLayer(viewer)
useTectonicLayer(viewer)
terrainLabStore.registerLab(regionTerrain)

const drawingStore = useDrawingStore()
const { activeTool, shapes, selectedShapeId } = storeToRefs(drawingStore)
const aiStore = useAiStore()
const isAnnotationPanelOpen = ref(false)
const annotationDraft = ref('')
const selectedShape = computed(() => shapes.value.find((shape) => shape.id === selectedShapeId.value) ?? null)
const levelSwitcherVisible = computed(() => isGlobeReady.value && camera.value.height < 5000000)
const drawHint = computed(() => (activeTool.value ? (activeTool.value === 'point' ? '在地球上单击以放置点' : '单击加点 · 双击或右键完成 · Esc 取消') : ''))

const toolbarPanels = computed(() => {
  const active: string[] = []
  if (isLayerPanelOpen.value) active.push('layers')
  if (isAnnotationPanelOpen.value) active.push('annotations')
  if (terrainLabStore.panelOpen) active.push('terrain')
  if (monsoonStore.panelOpen) active.push('monsoon')
  if (solarStore.panelOpen) active.push('solar')
  if (tectonicStore.panelOpen) active.push('tectonic')
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
    monsoonStore.setPanelOpen(true)
    return { status: 'ok', month, message: `季风气候实验室已切换到 ${month} 月` }
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

watch(selectedShape, (shape) => {
  annotationDraft.value = shape?.annotation ?? ''
})

function handleOpenLayers(): void {
  aiStore.setPanelOpen(false)
  store.setLayerPanelOpen(true)
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

function handleTool(tool: DrawTool): void {
  drawingStore.setActiveTool(activeTool.value === tool ? null : tool)
}

function handleOpenAnnotations(): void {
  isAnnotationPanelOpen.value = true
}

function handleClearShapes(): void {
  Modal.confirm({ title: '清除全部标注？', okText: '清除', okButtonProps: { danger: true }, cancelText: '取消', onOk: () => drawingStore.clearAll() })
}

function handleFlyShape(id: string): void {
  const shape = shapes.value.find((item) => item.id === id)
  if (shape) flyToShape(shape)
}

function saveSelectedAnnotation(): void {
  if (!selectedShape.value) return
  drawingStore.updateAnnotation(selectedShape.value.id, annotationDraft.value.trim())
  drawingStore.setSelectedShapeId(null)
}

function deleteSelectedShape(): void {
  if (selectedShape.value) drawingStore.removeShape(selectedShape.value.id)
}
</script>

<template>
  <div class="app">
    <div ref="globeContainer" class="globe" :class="{ drawing: activeTool }"></div>
    <GlobeToolbar
      :active-tool="activeTool"
      :shape-count="shapes.length"
      :active-panels="toolbarPanels"
      @open-layers="handleOpenLayers"
      @open-annotations="handleOpenAnnotations"
      @open-terrain-lab="terrainLabStore.setPanelOpen(true)"
      @open-monsoon="monsoonStore.setPanelOpen(true)"
      @open-solar="solarStore.setPanelOpen(true)"
      @open-tectonic="tectonicStore.setPanelOpen(true)"
      @open-assistant="handleOpenAssistant"
      @home="handleHome"
      @tool="handleTool"
      @clear-shapes="handleClearShapes"
    />
    <PlaceSearchBox @select="flyToPlace" />
    <div v-if="drawHint" class="draw-hint">{{ drawHint }}</div>
    <CameraStatus :camera="camera" />
    <EoqAssistant />
    <AiSettingsModal />
    <LevelViewSwitcher
      :level-view-active="levelViewActive"
      :visible="levelSwitcherVisible"
      @toggle="handleLevelViewToggle"
    />
    <AnnotationPanel
      :open="isAnnotationPanelOpen"
      :shapes="shapes"
      :selected-shape-id="selectedShapeId"
      @close="isAnnotationPanelOpen = false"
      @select="drawingStore.setSelectedShapeId"
      @fly="handleFlyShape"
      @remove="drawingStore.removeShape"
    />
    <a-modal :open="Boolean(selectedShape)" title="编辑标注" :width="380" @cancel="drawingStore.setSelectedShapeId(null)">
      <a-input v-model:value="annotationDraft" :maxlength="200" placeholder="标注名称" @press-enter="saveSelectedAnnotation" />
      <template #footer>
        <a-button danger @click="deleteSelectedShape">删除</a-button>
        <a-button @click="drawingStore.setSelectedShapeId(null)">取消</a-button>
        <a-button type="primary" @click="saveSelectedAnnotation">保存</a-button>
      </template>
    </a-modal>
    <TerrainLabPanel />
    <MonsoonPanel />
    <SolarPanel />
    <TectonicPanel />
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

.globe.drawing :deep(canvas) {
  cursor: crosshair;
}

.draw-hint {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 12px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.72);
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  line-height: 20px;
  pointer-events: none;
}
</style>
