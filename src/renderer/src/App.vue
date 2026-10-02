<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Modal } from 'ant-design-vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useGlobeStore } from '@renderer/stores/globe'
import { useDrawingStore, type DrawTool, type GeoPosition } from '@renderer/stores/drawing'
import { useAiStore } from '@renderer/stores/ai'
import { useClimateStore } from '@renderer/stores/climate'
import { useCesiumViewer } from '@renderer/composables/useCesiumViewer'
import { useDrawing, measureShape } from '@renderer/composables/useDrawing'
import { useThematicLayers } from '@renderer/composables/useThematicLayers'
import GlobeToolbar from '@renderer/components/GlobeToolbar.vue'
import CameraStatus from '@renderer/components/CameraStatus.vue'
import LayerPanel from '@renderer/components/LayerPanel.vue'
import LevelViewSwitcher from '@renderer/components/LevelViewSwitcher.vue'
import AnnotationPanel from '@renderer/components/AnnotationPanel.vue'
import PlaceSearchBox from '@renderer/components/PlaceSearchBox.vue'
import WindParticles from '@renderer/components/WindParticles.vue'
import MonthTimeline from '@renderer/components/MonthTimeline.vue'
import ThematicLegend from '@renderer/components/ThematicLegend.vue'
import EoqAssistant from '@renderer/components/EoqAssistant.vue'
import AiSettingsModal from '@renderer/components/AiSettingsModal.vue'

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
const climateStore = useClimateStore()
const { overlays: thematicOverlays } = storeToRefs(climateStore)
useThematicLayers(viewer)

const drawingStore = useDrawingStore()
const { activeTool, shapes, selectedShapeId } = storeToRefs(drawingStore)
const aiStore = useAiStore()
const isAnnotationPanelOpen = ref(false)
const annotationDraft = ref('')
const selectedShape = computed(() => shapes.value.find((shape) => shape.id === selectedShapeId.value) ?? null)
const levelSwitcherVisible = computed(() => isGlobeReady.value && camera.value.height < 5000000)
const drawHint = computed(() => (activeTool.value ? (activeTool.value === 'point' ? '在地球上单击以放置点' : '单击加点 · 双击或右键完成 · Esc 取消') : ''))

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

function parsePositions(raw: unknown, minCount: number): GeoPosition[] | null {
  if (!Array.isArray(raw)) return null
  const positions: GeoPosition[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const longitude = Number(record.longitude)
    const latitude = Number(record.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) continue
    if (!positions.some((existing) => existing.longitude === longitude && existing.latitude === latitude)) positions.push({ longitude, latitude, height: 0 })
  }
  return positions.length >= minCount && positions.length <= 500 ? positions : null
}

aiStore.registerTool({
  definition: {
    name: 'add_marker',
    description: '在地图上添加一个带名称的标记点，持久保存并可在标注面板中管理。返回标记 id，可用于后续删除。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '标记名称，将显示在地图上（如“珠穆朗玛峰”）' },
        longitude: { type: 'number', description: '经度（WGS-84，-180 到 180）' },
        latitude: { type: 'number', description: '纬度（WGS-84，-90 到 90）' }
      },
      required: ['name', 'longitude', 'latitude']
    }
  },
  execute: async (args) => {
    const name = typeof args.name === 'string' ? args.name.trim().slice(0, 200) : ''
    if (!name) return { error: '标记名称不能为空' }
    const positions = parsePositions([args], 1)
    if (!positions) return { error: '坐标无效，需要 WGS-84 经纬度' }
    const id = crypto.randomUUID()
    drawingStore.addShape({ id, kind: 'point', positions, annotation: name, createdAt: Date.now() })
    return { status: 'ok', id, kind: 'point', name, longitude: positions[0].longitude, latitude: positions[0].latitude }
  }
})

aiStore.registerTool({
  definition: {
    name: 'draw_shape',
    description: '在地图上绘制线或闭合多边形，持久保存。线自动标注总长度、多边形自动标注面积，适合测距、测面、展示边界或路线；传入 name 则显示名称替代测量值。',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['polyline', 'polygon'], description: 'polyline 为线（至少 2 个顶点），polygon 为多边形（至少 3 个顶点）' },
        points: {
          type: 'array',
          description: '顶点坐标数组，按绘制顺序排列',
          items: {
            type: 'object',
            properties: {
              longitude: { type: 'number', description: '经度（WGS-84）' },
              latitude: { type: 'number', description: '纬度（WGS-84）' }
            },
            required: ['longitude', 'latitude']
          }
        },
        name: { type: 'string', description: '可选名称；省略时图上显示自动测量的长度或面积' }
      },
      required: ['kind', 'points']
    }
  },
  execute: async (args) => {
    let kind: 'polyline' | 'polygon' | null = null
    if (args.kind === 'polygon') kind = 'polygon'
    else if (args.kind === 'polyline') kind = 'polyline'
    if (!kind) return { error: 'kind 必须为 polyline 或 polygon' }
    const positions = parsePositions(args.points, kind === 'polygon' ? 3 : 2)
    if (!positions) return { error: `坐标无效：${kind === 'polygon' ? '多边形需要至少 3 个' : '线需要至少 2 个'}有效且不重复的经纬度顶点` }
    const name = typeof args.name === 'string' ? args.name.trim().slice(0, 200) : ''
    const shape = { id: crypto.randomUUID(), kind, positions, annotation: name, createdAt: Date.now() }
    drawingStore.addShape(shape)
    const measurement = measureShape(shape)
    return { status: 'ok', id: shape.id, kind, name: name || undefined, vertices: positions.length, measurement: measurement || undefined }
  }
})

aiStore.registerTool({
  definition: {
    name: 'list_shapes',
    description: '列出地图上现有的全部标注（点标记、线、多边形），含 id、名称、类型、首个顶点坐标与测量值。删除前或回答“地图上有哪些标注”时使用。',
    parameters: { type: 'object', properties: {} }
  },
  execute: async () => ({
    shapes: shapes.value.map((shape) => ({
      id: shape.id,
      kind: shape.kind,
      name: shape.annotation || undefined,
      vertices: shape.positions.length,
      longitude: shape.positions.length ? Math.round(shape.positions[0].longitude * 10000) / 10000 : undefined,
      latitude: shape.positions.length ? Math.round(shape.positions[0].latitude * 10000) / 10000 : undefined,
      measurement: measureShape(shape) || undefined
    }))
  })
})

aiStore.registerTool({
  definition: {
    name: 'remove_shape',
    description: '删除地图上的标注：优先按 id 精确删除（id 来自 add_marker/draw_shape 返回值或 list_shapes），否则按名称精确匹配删除（同名标注全部删除）。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '标注 id' },
        name: { type: 'string', description: '标注名称（精确匹配）' }
      }
    }
  },
  execute: async (args) => {
    const id = typeof args.id === 'string' ? args.id : ''
    if (id) {
      if (!shapes.value.some((shape) => shape.id === id)) return { error: `未找到 id 为 ${id} 的标注，可先调用 list_shapes 查看` }
      drawingStore.removeShape(id)
      return { status: 'ok', removed: 1 }
    }
    const name = typeof args.name === 'string' ? args.name.trim() : ''
    if (!name) return { error: '需要提供 id 或 name' }
    const matched = shapes.value.filter((shape) => shape.annotation === name)
    if (!matched.length) return { error: `未找到名为「${name}」的标注，可先调用 list_shapes 查看` }
    for (const shape of matched) drawingStore.removeShape(shape.id)
    return { status: 'ok', removed: matched.length }
  }
})

aiStore.registerTool({
  definition: {
    name: 'capture_view',
    description: '截取当前地球视角的纯地图画面（不含任何界面控件）作为图片，并返回观察上下文：中心经纬度、视点高度、朝向、俯仰角与可见地理范围。用于回答“看看这里”“这是不是某种地貌”“我现在看到的是什么”等基于当前画面的问题。',
    parameters: { type: 'object', properties: {} }
  },
  execute: async () => {
    const current = viewer.value
    if (!current || current.isDestroyed()) return { error: '地球尚未就绪' }
    const loadStart = Date.now()
    while (!current.scene.globe.tilesLoaded && Date.now() - loadStart < 3000) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const canvas = current.scene.canvas
    const scale = Math.min(1, 1280 / Math.max(canvas.width, canvas.height))
    const offscreen = document.createElement('canvas')
    offscreen.width = Math.max(1, Math.round(canvas.width * scale))
    offscreen.height = Math.max(1, Math.round(canvas.height * scale))
    const context = offscreen.getContext('2d')
    if (!context) return { error: '截图失败' }
    context.drawImage(canvas, 0, 0, offscreen.width, offscreen.height)
    const image = offscreen.toDataURL('image/jpeg', 0.85)
    if (!image.startsWith('data:image/')) return { error: '截图失败' }
    const cartographic = current.camera.positionCartographic
    const headingDegrees = Cesium.Math.toDegrees(current.camera.heading)
    const picked = [[0, 0], [canvas.clientWidth, 0], [0, canvas.clientHeight], [canvas.clientWidth, canvas.clientHeight]]
      .map(([x, y]) => current.camera.pickEllipsoid(new Cesium.Cartesian2(x, y), current.scene.globe.ellipsoid))
      .filter((cartesian): cartesian is Cesium.Cartesian3 => Boolean(cartesian))
      .map((cartesian) => Cesium.Cartographic.fromCartesian(cartesian))
    const extent = picked.length >= 3
      ? {
          west: Math.round(Cesium.Math.toDegrees(Math.min(...picked.map((item) => item.longitude))) * 10000) / 10000,
          south: Math.round(Cesium.Math.toDegrees(Math.min(...picked.map((item) => item.latitude))) * 10000) / 10000,
          east: Math.round(Cesium.Math.toDegrees(Math.max(...picked.map((item) => item.longitude))) * 10000) / 10000,
          north: Math.round(Cesium.Math.toDegrees(Math.max(...picked.map((item) => item.latitude))) * 10000) / 10000
        }
      : undefined
    return {
      status: 'ok',
      screenshot: true,
      image,
      imageWidth: offscreen.width,
      imageHeight: offscreen.height,
      camera: {
        longitude: Math.round(Cesium.Math.toDegrees(cartographic.longitude) * 10000) / 10000,
        latitude: Math.round(Cesium.Math.toDegrees(cartographic.latitude) * 10000) / 10000,
        height: Math.round(cartographic.height),
        heading: Math.round(headingDegrees < 0 ? headingDegrees + 360 : headingDegrees),
        pitch: Math.round(Cesium.Math.toDegrees(current.camera.pitch) * 10) / 10
      },
      extent
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
    <WindParticles v-if="thematicOverlays['wind-particles']" :viewer="viewer" />
    <GlobeToolbar
      :active-tool="activeTool"
      :shape-count="shapes.length"
      @open-layers="handleOpenLayers"
      @open-annotations="handleOpenAnnotations"
      @open-assistant="handleOpenAssistant"
      @home="handleHome"
      @tool="handleTool"
      @clear-shapes="handleClearShapes"
    />
    <PlaceSearchBox @select="flyToPlace" />
    <MonthTimeline />
    <ThematicLegend />
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
