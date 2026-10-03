import { reactive, type Ref } from 'vue'
import * as Cesium from 'cesium'
import type { RecordingSaveResult, SceneCamera, SceneSimTime, SceneSnapshot, TeachingScene } from '../../../preload'
import { useGlobeStore } from '@renderer/stores/globe'
import { useClimateStore, thematicLayerCatalog } from '@renderer/stores/climate'
import { useSolarStore, type MotionPanel } from '@renderer/stores/solar'
import { useDrawingStore, DEFAULT_DRAW_STYLE, type GeoPosition } from '@renderer/stores/drawing'
import { useScenesStore } from '@renderer/stores/scenes'
import { createVideoRecorder, type RecorderOverlay } from './useVideoRecorder'

export interface RecordingMarker {
  name: string
  longitude: number
  latitude: number
}

export interface RecordingShape {
  kind: 'polyline' | 'polygon'
  name: string
  positions: GeoPosition[]
}

export interface RecordingStep {
  name: string
  narration: string
  camera: SceneCamera
  basemapId: string
  overlays: string[]
  month: number
  simTime: SceneSimTime | null
  dwellMs: number
  flyDurationMs: number
  markers: RecordingMarker[]
  shapes: RecordingShape[]
}

export interface PlayerState {
  active: boolean
  prewarming: boolean
  prewarmIndex: number
  prewarmTotal: number
  title: string
  sceneName: string
  narration: string
  currentIndex: number
  total: number
  mode: 'manual' | 'auto'
  recording: boolean
}

const PREWARM_TILE_TIMEOUT_MS = 10_000
const PLAY_TILE_TIMEOUT_MS = 10_000
const RECORD_TILE_TIMEOUT_MS = 18_000
const MORPH_TIMEOUT_MS = 5_000
const BASEMAP_SETTLE_MS = 500
const STATE_SETTLE_MS = 250
const PREWARM_HOLD_MS = 400

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizedHeadingDegrees(radians: number): number {
  if (!Number.isFinite(radians)) return 0
  const degrees = Cesium.Math.toDegrees(radians) % 360
  return degrees < 0 ? degrees + 360 : degrees
}

function sanitizeCamera(camera: SceneCamera): SceneCamera {
  const clampNumber = (value: number, min: number, max: number, fallback: number): number =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
  return {
    longitude: clampNumber(camera.longitude, -180, 180, 105),
    latitude: clampNumber(camera.latitude, -90, 90, 35),
    height: clampNumber(camera.height, 1000, 20000000, 8000000),
    heading: normalizedHeadingDegrees(camera.heading),
    pitch: clampNumber(camera.pitch, -89.9, 89.9, -90)
  }
}

function cameraDestination(camera: SceneCamera, centerTarget: boolean): Cesium.Cartesian3 {
  if (!centerTarget) return Cesium.Cartesian3.fromDegrees(camera.longitude, camera.latitude, camera.height)
  const downward = Math.max(Cesium.Math.toRadians(5), -Cesium.Math.toRadians(camera.pitch))
  const horizontal = camera.height / Math.tan(downward)
  const heading = Cesium.Math.toRadians(camera.heading)
  const offset = new Cesium.Cartesian3(-horizontal * Math.sin(heading), -horizontal * Math.cos(heading), camera.height)
  const target = Cesium.Cartesian3.fromDegrees(camera.longitude, camera.latitude, 0)
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(target)
  return Cesium.Matrix4.multiplyByPoint(enu, offset, new Cesium.Cartesian3())
}

function cameraOrientation(camera: SceneCamera): { heading: number; pitch: number; roll: number } {
  return {
    heading: Cesium.Math.toRadians(camera.heading),
    pitch: Cesium.Math.toRadians(camera.pitch),
    roll: 0
  }
}

export function useScenePlayer(viewer: Ref<Cesium.Viewer | undefined>, switchBasemap: (id: string) => void) {
  const globeStore = useGlobeStore()
  const climateStore = useClimateStore()
  const solarStore = useSolarStore()
  const drawingStore = useDrawingStore()
  const scenesStore = useScenesStore()
  const recorder = createVideoRecorder()

  const playerState = reactive<PlayerState>({
    active: false,
    prewarming: false,
    prewarmIndex: 0,
    prewarmTotal: 0,
    title: '',
    sceneName: '',
    narration: '',
    currentIndex: -1,
    total: 0,
    mode: 'manual',
    recording: false
  })

  let runId = 0
  let aborted = false
  let advanceResolver: (() => void) | null = null
  let advanceTimer: ReturnType<typeof setTimeout> | undefined

  function clearAdvance(): void {
    if (advanceTimer !== undefined) {
      clearTimeout(advanceTimer)
      advanceTimer = undefined
    }
  }

  function next(): void {
    advanceResolver?.()
  }

  function stop(): void {
    aborted = true
    next()
  }

  function waitAdvance(timeoutMs: number | null): Promise<void> {
    clearAdvance()
    return new Promise((resolve) => {
      advanceResolver = () => {
        advanceResolver = null
        clearAdvance()
        resolve()
      }
      if (timeoutMs !== null) advanceTimer = setTimeout(() => advanceResolver?.(), timeoutMs)
    })
  }

  function captureSnapshot(): SceneSnapshot {
    const current = viewer.value
    if (!current || current.isDestroyed()) throw new Error('地球尚未就绪')
    if (current.scene.mode !== Cesium.SceneMode.SCENE3D) throw new Error('请先切换到 3D 视图再保存场景')
    const cartographic = current.camera.positionCartographic
    if (!Number.isFinite(cartographic.longitude) || !Number.isFinite(cartographic.latitude) || !Number.isFinite(cartographic.height)) throw new Error('当前视角无效，无法保存场景')
    return {
      camera: sanitizeCamera({
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        height: cartographic.height,
        heading: normalizedHeadingDegrees(current.camera.heading),
        pitch: Cesium.Math.toDegrees(current.camera.pitch)
      }),
      basemapId: globeStore.selectedLayerId,
      overlays: thematicLayerCatalog.filter((layer) => climateStore.overlays[layer.id]).map((layer) => layer.id),
      month: climateStore.month,
      simTime: solarStore.active ? { date: solarStore.date, hour: solarStore.hour } : null,
      motionPanel: solarStore.motionPanel
    }
  }

  function captureScene(name: string, narration: string, dwellMs = 6000, flyDurationMs = 3500): Omit<TeachingScene, 'createdAt'> {
    return {
      id: crypto.randomUUID(),
      name,
      narration,
      dwellMs,
      flyDurationMs,
      snapshot: captureSnapshot()
    }
  }

  function applySnapshot(snapshot: SceneSnapshot): void {
    if (snapshot.basemapId && snapshot.basemapId !== globeStore.selectedLayerId) switchBasemap(snapshot.basemapId)
    for (const layer of thematicLayerCatalog) {
      const enabled = snapshot.overlays.includes(layer.id)
      if (climateStore.overlays[layer.id] !== enabled) climateStore.setOverlay(layer.id, enabled)
    }
    if (snapshot.month !== climateStore.month) {
      climateStore.setMonth(snapshot.month)
      climateStore.isPlaying = false
    }
    if (snapshot.simTime) {
      solarStore.setDate(snapshot.simTime.date)
      solarStore.setHour(snapshot.simTime.hour)
      solarStore.isPlaying = false
      solarStore.isAnnualPlaying = false
      solarStore.setActive(true)
    } else if (solarStore.active) {
      solarStore.setActive(false)
    }
    const motionPanel = (snapshot.motionPanel ?? null) as MotionPanel | null
    if (solarStore.motionPanel !== motionPanel) solarStore.setMotionPanel(motionPanel)
  }

  function flyCamera(rawCamera: SceneCamera, durationSeconds: number, centerTarget = false): Promise<void> {
    const current = viewer.value
    if (!current || current.isDestroyed()) return Promise.resolve()
    const camera = sanitizeCamera(rawCamera)
    return new Promise((resolve) => {
      current.camera.flyTo({
        destination: cameraDestination(camera, centerTarget),
        orientation: cameraOrientation(camera),
        duration: Math.max(0.1, durationSeconds),
        complete: () => resolve(),
        cancel: () => resolve()
      })
    })
  }

  function setCameraView(rawCamera: SceneCamera, centerTarget = false): void {
    const current = viewer.value
    if (!current || current.isDestroyed() || current.scene.mode !== Cesium.SceneMode.SCENE3D) return
    const camera = sanitizeCamera(rawCamera)
    current.camera.setView({
      destination: cameraDestination(camera, centerTarget),
      orientation: cameraOrientation(camera)
    })
  }

  async function waitTilesLoaded(timeoutMs: number, isCancelled?: () => boolean): Promise<boolean> {
    const current = viewer.value
    if (!current || current.isDestroyed()) return false
    const start = Date.now()
    let stableSince = 0
    while (Date.now() - start < timeoutMs) {
      if (isCancelled?.()) return false
      await delay(120)
      if (current.scene.globe.tilesLoaded) {
        if (!stableSince) stableSince = Date.now()
        if (Date.now() - stableSince >= 500) return true
      } else {
        stableSince = 0
      }
    }
    return current.scene.globe.tilesLoaded
  }

  function ensureScene3D(): Promise<void> {
    const current = viewer.value
    if (!current || current.isDestroyed()) return Promise.resolve()
    if (current.scene.mode === Cesium.SceneMode.SCENE3D) return Promise.resolve()
    return new Promise((resolve) => {
      const complete = (): void => {
        current.scene.morphComplete.removeEventListener(complete)
        clearTimeout(fallback)
        resolve()
      }
      const fallback = setTimeout(complete, MORPH_TIMEOUT_MS)
      current.scene.morphComplete.addEventListener(complete)
      current.scene.morphTo3D(1.0)
      globeStore.setSceneMode('3D')
    })
  }

  async function prewarm(scenes: TeachingScene[], id: number, centerTarget: boolean): Promise<void> {
    playerState.prewarming = true
    playerState.prewarmTotal = scenes.length
    for (let index = 0; index < scenes.length; index += 1) {
      if (aborted || runId !== id) break
      playerState.prewarmIndex = index + 1
      const snapshot = scenes[index].snapshot
      const previousBasemapId = globeStore.selectedLayerId
      applySnapshot(snapshot)
      await delay(snapshot.basemapId && snapshot.basemapId !== previousBasemapId ? BASEMAP_SETTLE_MS : STATE_SETTLE_MS)
      setCameraView(snapshot.camera, centerTarget)
      await waitTilesLoaded(PREWARM_TILE_TIMEOUT_MS, () => aborted || runId !== id)
      await delay(PREWARM_HOLD_MS)
    }
    playerState.prewarming = false
  }

  function recorderOverlay(): RecorderOverlay {
    return { title: playerState.title, narration: playerState.narration }
  }

  async function saveRecording(cancelled: boolean): Promise<void> {
    scenesStore.setRecording({ state: 'saving', cancelled })
    const video = await recorder.stop()
    if (!video) {
      scenesStore.setRecording(cancelled ? { state: 'idle', cancelled: true } : { state: 'error', error: '未能生成视频数据' })
      return
    }
    try {
      const buffer = await video.blob.arrayBuffer()
      const result: RecordingSaveResult = await window.guEarth.recordings.save(buffer, video.mimeType)
      scenesStore.applyRecordingResult(result)
    } catch (error) {
      scenesStore.setRecording({ state: 'error', error: error instanceof Error ? error.message : '视频保存失败' })
    }
  }

  async function play(options: { scenes: TeachingScene[]; mode: 'manual' | 'auto'; title?: string; recording?: { tempShapeIds: string[] }; centerTarget?: boolean }): Promise<void> {
    const current = viewer.value
    if (!current || current.isDestroyed() || !options.scenes.length) return
    if (playerState.active) return
    runId += 1
    const id = runId
    const centerTarget = Boolean(options.centerTarget)
    aborted = false
    playerState.active = true
    playerState.mode = options.mode
    playerState.title = options.title ?? ''
    playerState.total = options.scenes.length
    playerState.currentIndex = -1
    playerState.sceneName = ''
    playerState.narration = ''
    playerState.recording = Boolean(options.recording)
    scenesStore.setPresenting(true)
    await ensureScene3D()
    if (aborted || runId !== id) {
      for (const shapeId of options.recording?.tempShapeIds ?? []) drawingStore.removeShape(shapeId)
      playerState.active = false
      playerState.recording = false
      scenesStore.setPresenting(false)
      return
    }
    if (options.recording) scenesStore.setRecording({ state: 'preparing', currentStep: 0, totalSteps: options.scenes.length, videoPath: '', error: '', cancelled: false })
    await prewarm(options.scenes, id, centerTarget)
    if (options.recording && !aborted && runId === id) {
      const canvas = viewer.value?.scene.canvas
      if (!canvas || !recorder.start(canvas, recorderOverlay)) {
        scenesStore.setRecording({ state: 'error', error: '当前环境不支持视频录制' })
        playerState.recording = false
      } else {
        recorder.pause()
        scenesStore.setRecording({ state: 'recording' })
      }
    }
    try {
      for (let index = 0; index < options.scenes.length; index += 1) {
        if (aborted || runId !== id) break
        const scene = options.scenes[index]
        playerState.currentIndex = index
        playerState.sceneName = scene.name
        applySnapshot(scene.snapshot)
        await delay(STATE_SETTLE_MS)
        if (playerState.recording) {
          setCameraView(scene.snapshot.camera, centerTarget)
          await waitTilesLoaded(RECORD_TILE_TIMEOUT_MS, () => aborted || runId !== id)
        } else {
          await flyCamera(scene.snapshot.camera, scene.flyDurationMs / 1000, centerTarget)
          if (aborted || runId !== id) break
          await waitTilesLoaded(PLAY_TILE_TIMEOUT_MS, () => aborted || runId !== id)
        }
        if (aborted || runId !== id) break
        playerState.narration = scene.narration
        if (playerState.recording) {
          scenesStore.setRecording({ currentStep: index + 1 })
          recorder.resume()
        }
        await waitAdvance(options.mode === 'auto' ? scene.dwellMs : null)
        if (playerState.recording) recorder.pause()
        playerState.narration = ''
      }
      if (playerState.recording && recorder.isStarted()) {
        await saveRecording(aborted)
      } else if (options.recording) {
        const state = scenesStore.recording.state
        if (state === 'preparing' || state === 'recording') scenesStore.setRecording({ state: 'idle' })
      }
    } finally {
      if (options.recording?.tempShapeIds.length) {
        for (const shapeId of options.recording.tempShapeIds) drawingStore.removeShape(shapeId)
      }
      playerState.active = false
      playerState.recording = false
      scenesStore.setPresenting(false)
    }
  }

  async function recordVideo(title: string, steps: RecordingStep[]): Promise<{ status: string; totalSteps: number; estimatedSeconds: number } | { error: string }> {
    const current = viewer.value
    if (!current || current.isDestroyed()) return { error: '地球尚未就绪' }
    if (playerState.active) return { error: '已有演示或录制正在进行，请等待完成或按 Esc 结束后再试' }
    if (typeof MediaRecorder === 'undefined') return { error: '当前环境不支持视频录制' }
    const scenes: TeachingScene[] = steps.map((step) => ({
      id: crypto.randomUUID(),
      name: step.name,
      narration: step.narration,
      dwellMs: step.dwellMs,
      flyDurationMs: step.flyDurationMs,
      snapshot: {
        camera: step.camera,
        basemapId: step.basemapId,
        overlays: step.overlays,
        month: step.month,
        simTime: step.simTime,
        motionPanel: null
      },
      createdAt: Date.now()
    }))
    const tempShapeIds: string[] = []
    for (const step of steps) {
      for (const marker of step.markers) {
        const id = crypto.randomUUID()
        drawingStore.addTransientShape({ ...DEFAULT_DRAW_STYLE, id, kind: 'point', positions: [{ longitude: marker.longitude, latitude: marker.latitude, height: 0 }], annotation: marker.name, createdAt: Date.now() })
        tempShapeIds.push(id)
      }
      for (const shape of step.shapes) {
        const id = crypto.randomUUID()
        drawingStore.addTransientShape({ ...DEFAULT_DRAW_STYLE, id, kind: shape.kind, positions: shape.positions, annotation: shape.name, createdAt: Date.now() })
        tempShapeIds.push(id)
      }
    }
    const estimatedSeconds = Math.round(scenes.reduce((total, scene) => total + scene.flyDurationMs / 1000 + scene.dwellMs / 1000, 0)) + 3
    void play({ scenes, mode: 'auto', title, recording: { tempShapeIds }, centerTarget: true })
    return { status: 'started', totalSteps: scenes.length, estimatedSeconds }
  }

  async function previewScene(scene: TeachingScene): Promise<void> {
    const current = viewer.value
    if (!current || current.isDestroyed() || playerState.active) return
    applySnapshot(scene.snapshot)
    await delay(STATE_SETTLE_MS)
    await flyCamera(scene.snapshot.camera, Math.min(scene.flyDurationMs / 1000, 2.5))
    await waitTilesLoaded(PLAY_TILE_TIMEOUT_MS)
  }

  return { playerState, captureScene, captureSnapshot, play, recordVideo, previewScene, next, stop }
}
