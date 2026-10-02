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
import { useClimateStore } from '@renderer/stores/climate'
import { useCesiumViewer } from '@renderer/composables/useCesiumViewer'
import { useDrawLayer } from '@renderer/composables/useDrawLayer'
import { useRegionTerrain } from '@renderer/composables/useRegionTerrain'
import { useMonsoonLayer } from '@renderer/composables/useMonsoonLayer'
import { usePressureWindLayer } from '@renderer/composables/usePressureWindLayer'
import { useSolarLayer } from '@renderer/composables/useSolarLayer'
import { useTectonicLayer } from '@renderer/composables/useTectonicLayer'
import { useTyphoonMarker } from '@renderer/composables/useTyphoonMarker'
import { useThematicLayers } from '@renderer/composables/useThematicLayers'
import { useScaleBar } from '@renderer/composables/useScaleBar'
import { climateRegionAt, latitudeZoneName } from '@renderer/utils/climateData'
import { findTeachingLayer } from '@renderer/teaching/registry'
import { formatAreaKm2, pathLengthKm, sphericalPolygonAreaKm2 } from '@renderer/utils/measure'
import type { AnnotationData } from '../../preload'
import '@renderer/teaching'
import GlobeToolbar from '@renderer/components/GlobeToolbar.vue'
import CameraStatus from '@renderer/components/CameraStatus.vue'
import LayerPanel from '@renderer/components/LayerPanel.vue'
import PlaceSearchBox from '@renderer/components/PlaceSearchBox.vue'
import WindParticles from '@renderer/components/WindParticles.vue'
import MonthTimeline from '@renderer/components/MonthTimeline.vue'
import ThematicLegend from '@renderer/components/ThematicLegend.vue'
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
const climateStore = useClimateStore()
const { overlays: thematicOverlays } = storeToRefs(climateStore)
useThematicLayers(viewer)
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

function parsePoints(raw: unknown, minCount: number): Array<[number, number]> | null {
  if (!Array.isArray(raw)) return null
  const points: Array<[number, number]> = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const longitude = Number(record.longitude)
    const latitude = Number(record.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) continue
    if (!points.some((existing) => existing[0] === longitude && existing[1] === latitude)) points.push([longitude, latitude])
  }
  return points.length >= minCount && points.length <= 500 ? points : null
}

function annotationMeasurement(item: AnnotationData): string {
  if (item.kind === 'line' && item.distanceKm !== null) return item.distanceKm < 100 ? `${item.distanceKm.toFixed(1)} km` : `${Math.round(item.distanceKm).toLocaleString()} km`
  if (item.kind === 'polygon' && item.areaKm2 !== null) return formatAreaKm2(item.areaKm2)
  return ''
}

async function createAnnotation(kind: 'point' | 'line' | 'polygon', points: Array<[number, number]>, name: string): Promise<AnnotationData | null> {
  const distanceKm = kind === 'line' ? Math.round(pathLengthKm(points) * 10) / 10 : null
  const areaKm2 = kind === 'polygon' ? Math.round(sphericalPolygonAreaKm2(points) * 10) / 10 : null
  const annotation = await drawStore.addAnnotation(kind, points, distanceKm, areaKm2)
  if (name && annotation) await drawStore.updateAnnotation(annotation.id, { name })
  return annotation
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
    const points = parsePoints([args], 1)
    if (!points) return { error: '坐标无效，需要 WGS-84 经纬度' }
    try {
      const annotation = await createAnnotation('point', points, name)
      if (!annotation) return { error: '标注保存失败' }
      return { status: 'ok', id: annotation.id, kind: 'point', name, longitude: points[0][0], latitude: points[0][1] }
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : '标注保存失败' }
    }
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
    const kind = args.kind === 'polygon' ? 'polygon' : args.kind === 'polyline' ? 'line' : null
    if (!kind) return { error: 'kind 必须为 polyline 或 polygon' }
    const points = parsePoints(args.points, kind === 'polygon' ? 3 : 2)
    if (!points) return { error: `坐标无效：${kind === 'polygon' ? '多边形需要至少 3 个' : '线需要至少 2 个'}有效且不重复的经纬度顶点` }
    const name = typeof args.name === 'string' ? args.name.trim().slice(0, 200) : ''
    try {
      const annotation = await createAnnotation(kind, points, name)
      if (!annotation) return { error: '标注保存失败' }
      const measurement = annotationMeasurement(annotation)
      return { status: 'ok', id: annotation.id, kind: args.kind, name: name || undefined, vertices: points.length, measurement: measurement || undefined }
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : '标注保存失败' }
    }
  }
})

aiStore.registerTool({
  definition: {
    name: 'list_shapes',
    description: '列出地图上现有的全部标注（点标记、线、多边形），含 id、名称、类型、首个顶点坐标与测量值。删除前或回答“地图上有哪些标注”时使用。',
    parameters: { type: 'object', properties: {} }
  },
  execute: async () => ({
    shapes: drawStore.annotations.map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name || undefined,
      vertices: item.points.length,
      longitude: item.points.length ? Math.round(item.points[0][0] * 10000) / 10000 : undefined,
      latitude: item.points.length ? Math.round(item.points[0][1] * 10000) / 10000 : undefined,
      measurement: annotationMeasurement(item) || undefined
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
      if (!drawStore.annotations.some((item) => item.id === id)) return { error: `未找到 id 为 ${id} 的标注，可先调用 list_shapes 查看` }
      try {
        await drawStore.removeAnnotation(id)
      } catch (cause) {
        return { error: cause instanceof Error ? cause.message : '标注删除失败' }
      }
      return { status: 'ok', removed: 1 }
    }
    const name = typeof args.name === 'string' ? args.name.trim() : ''
    if (!name) return { error: '需要提供 id 或 name' }
    const matched = drawStore.annotations.filter((item) => item.name === name)
    if (!matched.length) return { error: `未找到名为「${name}」的标注，可先调用 list_shapes 查看` }
    try {
      for (const item of matched) await drawStore.removeAnnotation(item.id)
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : '标注删除失败' }
    }
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
    <WindParticles v-if="thematicOverlays['wind-particles']" :viewer="viewer" />
    <GlobeToolbar
      :active-panels="toolbarPanels"
      :level-view-active="levelViewActive"
      :level-view-visible="levelSwitcherVisible"
      @open="handleToolbarOpen"
      @home="handleHome"
      @toggle-level-view="handleLevelViewToggle"
    />
    <PlaceSearchBox @select="flyToPlace" />
    <MonthTimeline />
    <ThematicLegend />
    <LegendBar />
    <CameraStatus :camera="camera" :scale-bar="scaleBarReadout" />
    <EoqAssistant />
    <AiSettingsModal />
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
