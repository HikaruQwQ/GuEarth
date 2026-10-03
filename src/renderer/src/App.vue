<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { Modal } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useGlobeStore } from '@renderer/stores/globe'
import { useFailureStore } from '@renderer/stores/failure'
import { DEFAULT_DRAW_STYLE, useDrawingStore, type DrawnShape, type DrawTool, type GeoPosition } from '@renderer/stores/drawing'
import { useAiStore } from '@renderer/stores/ai'
import { useUpdaterStore } from '@renderer/stores/updater'
import { thematicLayerCatalog, useClimateStore } from '@renderer/stores/climate'
import { useSolarStore } from '@renderer/stores/solar'
import { useAtmosphereStore } from '@renderer/stores/atmosphere'
import { useHydrologyStore } from '@renderer/stores/hydrology'
import { useLandformStore } from '@renderer/stores/landform'
import { useCesiumViewer } from '@renderer/composables/useCesiumViewer'
import { useDrawing, measureShape } from '@renderer/composables/useDrawing'
import { useThematicLayers } from '@renderer/composables/useThematicLayers'
import { useTimezoneCompare } from '@renderer/composables/useTimezoneCompare'
import { datePartsOf, dayLength, declinationForDate, formatClock, isValidDate, noonAltitudeDeg, sunTimes } from '@renderer/thematic/solarMath'
import { nearestBoundary, plateBoundaryKindName } from '@renderer/thematic/plateBoundaries'
import GlobeToolbar from '@renderer/components/GlobeToolbar.vue'
import CameraStatus from '@renderer/components/CameraStatus.vue'
import LayerPanel from '@renderer/components/LayerPanel.vue'
import AnnotationPanel from '@renderer/components/AnnotationPanel.vue'
import DrawingEditToolbar from '@renderer/components/DrawingEditToolbar.vue'
import InlineTextEditor from '@renderer/components/InlineTextEditor.vue'
import PlaceSearchBox from '@renderer/components/PlaceSearchBox.vue'
import WindParticles from '@renderer/components/WindParticles.vue'
import MonthTimeline from '@renderer/components/MonthTimeline.vue'
import SolarTimePanel from '@renderer/components/SolarTimePanel.vue'
import SolarPathPanel from '@renderer/components/SolarPathPanel.vue'
import ObliquityPanel from '@renderer/components/ObliquityPanel.vue'
import RotationSpeedPanel from '@renderer/components/RotationSpeedPanel.vue'
import ThermalCirculationPanel from '@renderer/components/ThermalCirculationPanel.vue'
import AtmosphereHeatingPanel from '@renderer/components/AtmosphereHeatingPanel.vue'
import AtmosphereLayersPanel from '@renderer/components/AtmosphereLayersPanel.vue'
import TyphoonOverlay from '@renderer/components/TyphoonOverlay.vue'
import WalkerCirculationOverlay from '@renderer/components/WalkerCirculationOverlay.vue'
import EnsoPanel from '@renderer/components/EnsoPanel.vue'
import WaterCyclePanel from '@renderer/components/WaterCyclePanel.vue'
import OceanPropertyPanel from '@renderer/components/OceanPropertyPanel.vue'
import TideWavePanel from '@renderer/components/TideWavePanel.vue'
import WaterBodyPanel from '@renderer/components/WaterBodyPanel.vue'
import FoldFaultPanel from '@renderer/components/FoldFaultPanel.vue'
import RiverLandformPanel from '@renderer/components/RiverLandformPanel.vue'
import LandformGuidePanel from '@renderer/components/LandformGuidePanel.vue'
import ExogenicPanel from '@renderer/components/ExogenicPanel.vue'
import EarthLayersPanel from '@renderer/components/EarthLayersPanel.vue'
import TimezonePanel from '@renderer/components/TimezonePanel.vue'
import ThematicLegend from '@renderer/components/ThematicLegend.vue'
import FrontalCyclone from '@renderer/components/FrontalCyclone.vue'
import ThematicInfoCard from '@renderer/components/ThematicInfoCard.vue'
import TeachingLab from '@renderer/components/TeachingLab.vue'
import EoqAssistant from '@renderer/components/EoqAssistant.vue'
import AiSettingsModal from '@renderer/components/AiSettingsModal.vue'
import UpdateDialog from '@renderer/components/UpdateDialog.vue'
import FailureBanner from '@renderer/components/FailureBanner.vue'
import FirstUseGuide from '@renderer/components/FirstUseGuide.vue'

const store = useGlobeStore()
const {
  isLayerPanelOpen,
  layers,
  selectedLayerId,
  globeError,
  terrainError,
  isGlobeReady,
  globeLoadTimedOut,
  globeLoadStage,
  activeTerrainId,
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
const { comparison: timezoneComparison, clearComparison: clearTimezone } = useTimezoneCompare(viewer)
const climateStore = useClimateStore()
const solarStore = useSolarStore()
const atmosphereStore = useAtmosphereStore()
const hydrologyStore = useHydrologyStore()
const landformStore = useLandformStore()
const { overlays: thematicOverlays } = storeToRefs(climateStore)
useThematicLayers(viewer)

const drawingStore = useDrawingStore()
const { activeTool, shapes, entries, selectedShapeId, saveError } = storeToRefs(drawingStore)
const aiStore = useAiStore()
const updaterStore = useUpdaterStore()
const failureStore = useFailureStore()
const firstUseGuide = ref<InstanceType<typeof FirstUseGuide> | null>(null)
const isAnnotationPanelOpen = ref(false)
const systemFonts = ref(['Arial', 'Segoe UI', 'Microsoft YaHei'])
const selectedShape = computed(() => shapes.value.find((shape) => shape.id === selectedShapeId.value) ?? null)
const levelSwitcherVisible = computed(() => isGlobeReady.value && camera.value.height < 5000000)
const showGlobeLoading = computed(() => !isGlobeReady.value && !globeError.value)
const isLabOpen = ref(false)
const labActive = computed(() => climateStore.hasActiveOverlay || solarStore.active || solarStore.motionPanel !== null || atmosphereStore.panel !== null || hydrologyStore.panel !== null || landformStore.panel !== null || activeTool.value === 'timezone')
const drawHint = computed(() => {
  if (!activeTool.value) return ''
  if (activeTool.value === 'timezone') return '单击选取两个地点对比地方时 · Esc 退出'
  if (activeTool.value === 'text') return '在地球上单击放置文本框 · Esc 退出'
  if (activeTool.value === 'arrow') return '依次单击箭头起点和终点 · Esc 取消'
  return activeTool.value === 'point' ? '在地球上单击以放置点' : '单击加点 · 双击或右键完成 · Esc 取消'
})

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

const MAX_MARKER_BATCH = 20

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

function collectStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => (typeof item === 'string' && item.trim() ? [item.trim()] : []))
}

aiStore.registerTool({
  definition: {
    name: 'add_marker',
    description: '在地图上添加带名称的标记点，持久保存并可在标注面板中管理。单个标记传 name/longitude/latitude；多个标记传 markers 数组一次批量添加（单次最多 20 个）。返回标记 id，可用于后续删除。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '标记名称，将显示在地图上（如“珠穆朗玛峰”）' },
        longitude: { type: 'number', description: '经度（WGS-84，-180 到 180）' },
        latitude: { type: 'number', description: '纬度（WGS-84，-90 到 90）' },
        markers: {
          type: 'array',
          description: '批量添加：标记对象数组，单项含 name、longitude、latitude；与单个 name/longitude/latitude 二选一',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: '标记名称' },
              longitude: { type: 'number', description: '经度（WGS-84）' },
              latitude: { type: 'number', description: '纬度（WGS-84）' }
            },
            required: ['name', 'longitude', 'latitude']
          }
        }
      }
    }
  },
  execute: async (args) => {
    const entries: unknown[] = Array.isArray(args.markers) ? args.markers : [args]
    if (entries.length > MAX_MARKER_BATCH) return { error: `单次最多添加 ${MAX_MARKER_BATCH} 个标记，请分批调用` }
    const added: { id: string; name: string; longitude: number; latitude: number }[] = []
    let skipped = 0
    for (const entry of entries) {
      const record = typeof entry === 'object' && entry !== null ? entry as Record<string, unknown> : {}
      const name = typeof record.name === 'string' ? record.name.trim().slice(0, 200) : ''
      const positions = parsePositions([record], 1)
      if (!name || !positions) { skipped += 1; continue }
      const id = crypto.randomUUID()
      drawingStore.addShape({ ...DEFAULT_DRAW_STYLE, id, kind: 'point', positions, annotation: name, createdAt: Date.now() })
      added.push({ id, name, longitude: positions[0].longitude, latitude: positions[0].latitude })
    }
    if (!added.length) return { error: '没有有效标记：需要名称与 WGS-84 经纬度坐标' }
    if (entries.length === 1) return { status: 'ok', id: added[0].id, kind: 'point', name: added[0].name, longitude: added[0].longitude, latitude: added[0].latitude }
    return { status: 'ok', added: added.length, skipped: skipped || undefined, markers: added }
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
    const shape = { ...DEFAULT_DRAW_STYLE, id: crypto.randomUUID(), kind, positions, annotation: name, createdAt: Date.now() }
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
    description: '删除地图上的标注：按 id 精确删除（id 来自 add_marker/draw_shape 返回值或 list_shapes）或按名称精确匹配删除（同名标注全部删除）；ids/names 数组为批量形式，可与单个 id/name 混用。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '标注 id' },
        ids: { type: 'array', description: '批量删除：标注 id 数组', items: { type: 'string' } },
        name: { type: 'string', description: '标注名称（精确匹配）' },
        names: { type: 'array', description: '批量删除：标注名称数组（精确匹配，同名全部删除）', items: { type: 'string' } }
      }
    }
  },
  execute: async (args) => {
    const ids = new Set(collectStrings(args.ids))
    if (typeof args.id === 'string' && args.id.trim()) ids.add(args.id.trim())
    const names = new Set(collectStrings(args.names))
    if (typeof args.name === 'string' && args.name.trim()) names.add(args.name.trim())
    if (!ids.size && !names.size) return { error: '需要提供 id/ids 或 name/names' }
    const missingIds: string[] = []
    const missingNames: string[] = []
    let removed = 0
    for (const id of ids) {
      if (!shapes.value.some((shape) => shape.id === id)) { missingIds.push(id); continue }
      drawingStore.removeShape(id)
      removed += 1
    }
    for (const name of names) {
      const matched = shapes.value.filter((shape) => shape.annotation === name)
      if (!matched.length) { missingNames.push(name); continue }
      for (const shape of matched) drawingStore.removeShape(shape.id)
      removed += matched.length
    }
    if (!removed) {
      const target = missingIds[0] ?? missingNames[0]
      return { error: `未找到标注「${target}」，可先调用 list_shapes 查看` }
    }
    return {
      status: 'ok',
      removed,
      missingIds: missingIds.length ? missingIds : undefined,
      missingNames: missingNames.length ? missingNames : undefined
    }
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
    const canvas = current.scene.canvas
    const viewContext = () => {
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
    if (!aiStore.activeModelVisionEnabled()) {
      return {
        status: 'vision_disabled',
        ...viewContext(),
        guidance: '当前模型未开启「视觉」能力，不会接收截图图片，本次已改为返回当前视角的文字信息（camera 与 extent）。请依据这些文本信息尽量回答；同时提醒用户：若该模型实际支持图像输入，可在「AI 设置」的模型列表中开启「视觉」开关后重试。'
      }
    }
    const loadStart = Date.now()
    while (!current.scene.globe.tilesLoaded && Date.now() - loadStart < 3000) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const scale = Math.min(1, 1280 / Math.max(canvas.width, canvas.height))
    const offscreen = document.createElement('canvas')
    offscreen.width = Math.max(1, Math.round(canvas.width * scale))
    offscreen.height = Math.max(1, Math.round(canvas.height * scale))
    const context = offscreen.getContext('2d')
    if (!context) return { error: '截图失败' }
    context.drawImage(canvas, 0, 0, offscreen.width, offscreen.height)
    const image = offscreen.toDataURL('image/jpeg', 0.85)
    if (!image.startsWith('data:image/')) return { error: '截图失败' }
    return {
      status: 'ok',
      screenshot: true,
      image,
      imageWidth: offscreen.width,
      imageHeight: offscreen.height,
      ...viewContext()
    }
  }
})

aiStore.registerTool({
  definition: {
    name: 'set_sim_time',
    description: '设置太阳光照模拟的日期与时刻（北京时间）并开启昼夜光照渲染，用于演示晨昏线、昼夜交替、极昼极夜与太阳直射点季节移动。',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '模拟日期，格式 YYYY-MM-DD，如 2026-06-22（夏至）。省略保持当前日期' },
        hour: { type: 'number', description: '模拟时刻（北京时间，0-24 的小时数，可用小数如 12.5 表示 12:30）。省略保持当前时刻' },
        play: { type: 'boolean', description: 'true 时自动播放昼夜交替动画（每秒约 1.5 小时）' }
      }
    }
  },
  execute: async (args) => {
    if (args.date !== undefined) {
      if (!isValidDate(args.date)) return { error: 'date 需为合法的 YYYY-MM-DD 日期' }
      solarStore.setDate(args.date)
    }
    if (args.hour !== undefined) {
      const hour = Number(args.hour)
      if (!Number.isFinite(hour) || hour < 0 || hour >= 24) return { error: 'hour 需为 0-24 的小时数' }
      solarStore.setHour(hour)
    }
    if (typeof args.play === 'boolean') solarStore.isPlaying = args.play
    solarStore.setActive(true)
    return {
      status: 'ok',
      date: solarStore.date,
      hourBeijing: solarStore.hour,
      utc: new Date(solarStore.utcMs).toISOString(),
      playing: solarStore.isPlaying,
      message: '昼夜光照已开启；可配合 fly_to 以 8000000-15000000 米高度展示晨昏线'
    }
  }
})

aiStore.registerTool({
  definition: {
    name: 'query_solar',
    description: '计算某纬度在指定日期的昼长、正午太阳高度角、日出日落地方时与极昼/极夜状态。用于讲解昼夜长短、太阳高度随纬度与季节的变化。',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: '纬度（-90 到 90，北纬为正）' },
        date: { type: 'string', description: '日期 YYYY-MM-DD，省略时使用当前模拟日期' }
      },
      required: ['latitude']
    }
  },
  execute: async (args) => {
    const latitude = Number(args.latitude)
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return { error: '纬度无效，需 -90 到 90' }
    let dateStr = solarStore.date
    if (args.date !== undefined) {
      if (!isValidDate(args.date)) return { error: 'date 需为合法的 YYYY-MM-DD 日期' }
      dateStr = args.date
    }
    const { month, day } = datePartsOf(dateStr)
    const declination = declinationForDate(month, day)
    const length = dayLength(latitude, declination)
    const times = sunTimes(latitude, declination)
    const round1 = (value: number) => Math.round(value * 10) / 10
    return {
      latitude: round1(latitude),
      date: dateStr,
      declinationDeg: round1(declination),
      noonAltitudeDeg: round1(noonAltitudeDeg(latitude, declination)),
      dayLengthHours: round1(length.hours),
      polar: length.state === 'polar-day' ? '极昼' : length.state === 'polar-night' ? '极夜' : undefined,
      sunriseLocalSolarTime: times.sunrise !== undefined ? formatClock(times.sunrise) : undefined,
      sunsetLocalSolarTime: times.sunset !== undefined ? formatClock(times.sunset) : undefined,
      note: '日出日落为地方时（平太阳时近似）'
    }
  }
})

aiStore.registerTool({
  definition: {
    name: 'set_layer',
    description: '开关教学专题图层并可选设置月份（1-12），用于讲解气压带与风带、气候类型、锋面气旋、洋流等。气压带风带图层会随月份在1月与7月位置间移动，适合对比讲解。',
    parameters: {
      type: 'object',
      properties: {
        layerId: {
          type: 'string',
          enum: thematicLayerCatalog.map((layer) => layer.id),
          description: '图层 id：pressure-belts 气压带与风带、koppen-zones 世界气候类型、frontal-cyclone 锋面气旋、ocean-currents 世界洋流、climate-zones 中国气候区、coriolis-demo 地转偏向力等'
        },
        enabled: { type: 'boolean', description: 'true 开启图层，false 关闭图层' },
        month: { type: 'number', description: '1-12 的月份整数，设置专题时间轴（如 1 月与 7 月对比气压带位置）' }
      },
      required: ['layerId', 'enabled']
    }
  },
  execute: async (args) => {
    const layer = thematicLayerCatalog.find((item) => item.id === args.layerId)
    if (!layer) return { error: `未知图层 ${String(args.layerId)}，可用图层：${thematicLayerCatalog.map((item) => `${item.id}（${item.name}）`).join('、')}` }
    if (typeof args.enabled !== 'boolean') return { error: 'enabled 需为布尔值' }
    climateStore.setOverlay(layer.id, args.enabled)
    if (args.month !== undefined) {
      const month = Number(args.month)
      if (!Number.isFinite(month) || month < 1 || month > 12) return { error: 'month 需为 1-12 的月份' }
      climateStore.setMonth(month)
      climateStore.isPlaying = false
    }
    return {
      status: 'ok',
      layerId: layer.id,
      name: layer.name,
      enabled: args.enabled,
      month: climateStore.month,
      message: args.enabled
        ? `已开启「${layer.name}」图层${args.month !== undefined ? `并设置月份为 ${climateStore.month} 月` : ''}；可在地球上点击图层要素查看成因`
        : `已关闭「${layer.name}」图层`
    }
  }
})

aiStore.registerTool({
  definition: {
    name: 'explain_landform',
    description: '查询某 WGS-84 经纬度的地表海拔与最近的板块边界（名称、边界类型、距离），用于分析地貌成因、讲解板块运动与地表形态塑造。',
    parameters: {
      type: 'object',
      properties: {
        longitude: { type: 'number', description: '经度（WGS-84，-180 到 180）' },
        latitude: { type: 'number', description: '纬度（WGS-84，-90 到 90）' }
      },
      required: ['longitude', 'latitude']
    }
  },
  execute: async (args) => {
    const current = viewer.value
    if (!current || current.isDestroyed()) return { error: '地球尚未就绪' }
    const longitude = Number(args.longitude)
    const latitude = Number(args.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return { error: '坐标无效，需要 WGS-84 经纬度' }
    const cartographic = Cesium.Cartographic.fromDegrees(longitude, latitude)
    let heightMeters: number | null = null
    try {
      const [sampled] = await Cesium.sampleTerrainMostDetailed(current.terrainProvider, [cartographic.clone()])
      if (sampled && Number.isFinite(sampled.height)) heightMeters = Math.round(sampled.height * 100) / 100
    } catch {
      void 0
    }
    if (heightMeters === null) {
      const fallback = current.scene.globe.getHeight(cartographic)
      if (typeof fallback === 'number' && Number.isFinite(fallback)) heightMeters = Math.round(fallback * 100) / 100
    }
    const nearest = nearestBoundary(longitude, latitude)
    const distanceKm = Math.round(nearest.distanceKm)
    return {
      longitude,
      latitude,
      heightMeters: heightMeters ?? undefined,
      heightNote: heightMeters === null ? '该位置地形数据暂不可用' : undefined,
      nearestBoundary: {
        name: nearest.boundary.name,
        kind: nearest.boundary.kind,
        kindName: plateBoundaryKindName[nearest.boundary.kind],
        distanceKm
      },
      hint: distanceKm <= 600
        ? '距板块边界较近，地貌成因以内力作用为主（板块碰撞挤压、俯冲、岩浆活动），可再结合外力作用分析'
        : '距板块边界较远，属板内环境，重点考虑外力作用（流水、风力、冰川、海浪）与岩石性质、地质构造'
    }
  }
})

onMounted(async () => {
  void updaterStore.hydrate()
  try {
    const installedFonts = await window.guEarth.system.fonts()
    const existingFonts = shapes.value.map((shape) => shape.fontFamily)
    systemFonts.value = [...new Set([...installedFonts, ...existingFonts])].sort((first, second) => first.localeCompare(second))
  } catch {
    systemFonts.value = ['Arial', 'Segoe UI', 'Microsoft YaHei']
  }
})

function handleOpenLayers(): void {
  aiStore.setPanelOpen(false)
  store.setLayerPanelOpen(true)
}

function handleOpenAssistant(): void {
  store.setLayerPanelOpen(false)
  aiStore.setPanelOpen(true)
}

function handleOpenSetupGuide(): void {
  firstUseGuide.value?.start()
}

function handleSetupGuideStepChange(step: number): void {
  aiStore.setSettingsOpen(false)
  aiStore.setPanelOpen(false)
  store.setLayerPanelOpen(step === 6)
  if (step === 8) aiStore.setSettingsOpen(true)
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
    failureStore.reportFailure({ scope: 'settings', message: '密钥保存失败', detail: '系统安全存储不可用', retryable: false })
  }
}

async function handleCredentialClear(id: string): Promise<void> {
  try {
    const status = await window.guEarth.settings.clearProviderApiKey(id)
    store.setCredentialStatus(id, status)
    const securityStatus = await window.guEarth.settings.clearProviderApiKey(`${id}-sk`)
    store.setCredentialStatus(`${id}-sk`, securityStatus)
  } catch {
    failureStore.reportFailure({ scope: 'settings', message: '密钥清除失败', retryable: false })
  }
}

function handleHome(): void {
  flyTo(105, 35, 15000000)
}

function handleRetry(): void {
  for (const notice of failureStore.active) {
    if (notice.retryable) void failureStore.retry(notice.scope)
  }
}

function handleLevelViewToggle(): void {
  toggleLevelView()
}

function handleUpdateClick(): void {
  if (updaterStore.status === 'available') {
    void updaterStore.startDownload()
    return
  }
  if (updaterStore.status === 'ready') {
    Modal.confirm({
      title: `重启并安装新版本 v${updaterStore.version}？`,
      content: '应用将退出并启动安装程序，完成后可重新打开 GuEarth。',
      okText: '重启安装',
      cancelText: '稍后',
      onOk: () => updaterStore.installNow()
    })
  }
}

function handleToggleLab(): void {
  isLabOpen.value = !isLabOpen.value
}

function handleTool(tool: DrawTool): void {
  const next = activeTool.value === tool ? null : tool
  drawingStore.setSelectedShapeId(null)
  drawingStore.setActiveTool(next)
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

function updateSelectedShape(changes: Partial<Pick<DrawnShape, 'annotation' | 'color' | 'textColor' | 'fontFamily' | 'fontSize' | 'textFrame' | 'lineWidth'>>): void {
  if (selectedShape.value) drawingStore.updateShape(selectedShape.value.id, changes)
}

function deleteSelectedShape(): void {
  if (!selectedShape.value) return
  drawingStore.removeShape(selectedShape.value.id)
}
</script>

<template>
  <div class="app">
    <div ref="globeContainer" class="globe" :class="{ drawing: activeTool }"></div>
    <InlineTextEditor
      :viewer="viewer"
      :shape="selectedShape?.kind === 'text' ? selectedShape : null"
      @update="(annotation) => updateSelectedShape({ annotation })"
    />
    <div v-if="showGlobeLoading" class="globe-loading">
      <a-spin :spinning="!globeLoadTimedOut" size="small" />
      <span class="globe-loading-text">{{ globeLoadTimedOut ? '地图加载较慢，请检查网络' : '正在加载地图…' }}</span>
      <span v-if="globeLoadStage" class="globe-loading-stage">{{ globeLoadStage }}</span>
      <a-button v-if="globeLoadTimedOut" type="text" size="small" @click="handleRetry"><ReloadOutlined />重试</a-button>
    </div>
    <FailureBanner />
    <WindParticles v-if="thematicOverlays['wind-particles']" :viewer="viewer" />
    <FrontalCyclone v-if="thematicOverlays['frontal-cyclone']" :viewer="viewer" />
    <TyphoonOverlay v-if="thematicOverlays['typhoon']" :viewer="viewer" />
    <WalkerCirculationOverlay v-if="thematicOverlays['enso']" :viewer="viewer" :phase="climateStore.ensoPhase" />
    <GlobeToolbar
      :active-tool="activeTool"
      :shape-count="shapes.length"
      :level-view-active="levelViewActive"
      :level-view-visible="levelSwitcherVisible"
      :lab-active="labActive"
      :update-status="updaterStore.status"
      :update-version="updaterStore.version"
      :update-percent="updaterStore.percent"
      @open-layers="handleOpenLayers"
      @open-annotations="handleOpenAnnotations"
      @open-assistant="handleOpenAssistant"
      @open-setup-guide="handleOpenSetupGuide"
      @home="handleHome"
      @tool="handleTool"
      @clear-shapes="handleClearShapes"
      @toggle-level-view="handleLevelViewToggle"
      @toggle-lab="handleToggleLab"
      @update-click="handleUpdateClick"
    />
    <DrawingEditToolbar
      v-if="selectedShape && !activeTool"
      :shape="selectedShape"
      :fonts="systemFonts"
      @change="updateSelectedShape"
      @remove="deleteSelectedShape"
    />
    <TeachingLab :open="isLabOpen" @close="isLabOpen = false" />
    <PlaceSearchBox @select="flyToPlace" />
    <MonthTimeline />
    <SolarTimePanel />
    <SolarPathPanel v-if="solarStore.motionPanel === 'solar-path'" @close="solarStore.setMotionPanel(null)" />
    <ObliquityPanel v-if="solarStore.motionPanel === 'obliquity'" @close="solarStore.setMotionPanel(null)" />
    <RotationSpeedPanel v-if="solarStore.motionPanel === 'rotation-speed'" @close="solarStore.setMotionPanel(null)" />
    <ThermalCirculationPanel v-if="atmosphereStore.panel === 'circulation'" @close="atmosphereStore.setPanel(null)" />
    <AtmosphereHeatingPanel v-if="atmosphereStore.panel === 'heating'" @close="atmosphereStore.setPanel(null)" />
    <AtmosphereLayersPanel v-if="atmosphereStore.panel === 'layers'" @close="atmosphereStore.setPanel(null)" />
    <EnsoPanel v-if="thematicOverlays['enso']" @close="climateStore.setOverlay('enso', false)" />
    <WaterCyclePanel v-if="hydrologyStore.panel === 'water-cycle'" :viewer="viewer" @close="hydrologyStore.setPanel(null)" />
    <OceanPropertyPanel v-if="hydrologyStore.panel === 'ocean-property'" @close="hydrologyStore.setPanel(null)" />
    <TideWavePanel v-if="hydrologyStore.panel === 'tide'" @close="hydrologyStore.setPanel(null)" />
    <WaterBodyPanel v-if="hydrologyStore.panel === 'water-bodies'" @close="hydrologyStore.setPanel(null)" />
    <FoldFaultPanel v-if="landformStore.panel === 'fold-fault'" :viewer="viewer" @close="landformStore.setPanel(null)" />
    <RiverLandformPanel v-if="landformStore.panel === 'river'" :viewer="viewer" @close="landformStore.setPanel(null)" />
    <LandformGuidePanel v-if="landformStore.panel === 'landform-guide'" :viewer="viewer" @close="landformStore.setPanel(null)" />
    <ExogenicPanel v-if="landformStore.panel === 'exogenic'" :viewer="viewer" @close="landformStore.setPanel(null)" />
    <EarthLayersPanel v-if="landformStore.panel === 'earth-layers'" @close="landformStore.setPanel(null)" />
    <TimezonePanel v-if="timezoneComparison" :comparison="timezoneComparison" @clear="clearTimezone" />
    <ThematicLegend />
    <ThematicInfoCard />
    <div v-if="drawHint" class="draw-hint">{{ drawHint }}</div>
    <CameraStatus :camera="camera" />
    <EoqAssistant />
    <AiSettingsModal />
    <FirstUseGuide ref="firstUseGuide" :ready="isGlobeReady" @step-change="handleSetupGuideStepChange" />
    <UpdateDialog />
    <AnnotationPanel
      :open="isAnnotationPanelOpen"
      :shapes="shapes"
      :entries="entries"
      :selected-shape-id="selectedShapeId"
      :save-error="saveError"
      @close="isAnnotationPanelOpen = false"
      @edit="drawingStore.setSelectedShapeId"
      @fly="handleFlyShape"
      @remove="drawingStore.removeShape"
    />
    <LayerPanel
      :open="isLayerPanelOpen"
      :layers="layers"
      :selected-layer-id="selectedLayerId"
      :error="globeError"
      :terrain-error="terrainError"
      :loading="!isGlobeReady"
      :terrain-provider-id="terrainProviderId"
      :active-terrain-id="activeTerrainId"
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

.globe-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1003;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  transform: translate(-50%, -50%);
}

.globe-loading-text {
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
}

.globe-loading-stage {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
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
  z-index: 11;
}

</style>
