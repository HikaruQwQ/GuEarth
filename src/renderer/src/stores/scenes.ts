import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { RecordingSaveResult, TeachingScene } from '../../../preload'

export type RecordingStateValue = 'idle' | 'preparing' | 'recording' | 'saving' | 'done' | 'error'

export interface RecordingSessionState {
  state: RecordingStateValue
  title: string
  currentStep: number
  totalSteps: number
  videoPath: string
  bytes: number
  error: string
  cancelled: boolean
}

const idleRecording: RecordingSessionState = { state: 'idle', title: '', currentStep: 0, totalSteps: 0, videoPath: '', bytes: 0, error: '', cancelled: false }

export const useScenesStore = defineStore('scenes', () => {
  const scenes = ref<TeachingScene[]>([])
  const hydrated = ref(false)
  const saveError = ref(false)
  const isPresenting = ref(false)
  const recording = ref<RecordingSessionState>({ ...idleRecording })

  async function hydrate(): Promise<void> {
    if (hydrated.value || !window.guEarth?.scenes) return
    hydrated.value = true
    try {
      const document = await window.guEarth.scenes.load()
      scenes.value = document.scenes
    } catch {
      scenes.value = []
    }
  }

  async function persist(): Promise<void> {
    saveError.value = false
    try {
      await window.guEarth.scenes.save({ scenes: scenes.value })
    } catch {
      saveError.value = true
    }
  }

  async function addScene(scene: Omit<TeachingScene, 'createdAt'>): Promise<TeachingScene> {
    await hydrate()
    const record: TeachingScene = { ...scene, createdAt: Date.now() }
    scenes.value = [...scenes.value, record]
    await persist()
    return record
  }

  async function updateScene(id: string, changes: Partial<Pick<TeachingScene, 'name' | 'narration' | 'dwellMs' | 'flyDurationMs'>>): Promise<void> {
    scenes.value = scenes.value.map((scene) => (scene.id === id ? { ...scene, ...changes } : scene))
    await persist()
  }

  async function removeScene(id: string): Promise<void> {
    scenes.value = scenes.value.filter((scene) => scene.id !== id)
    await persist()
  }

  async function moveScene(id: string, offset: -1 | 1): Promise<void> {
    const index = scenes.value.findIndex((scene) => scene.id === id)
    const target = index + offset
    if (index < 0 || target < 0 || target >= scenes.value.length) return
    const next = [...scenes.value]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    scenes.value = next
    await persist()
  }

  function setPresenting(value: boolean): void {
    isPresenting.value = value
  }

  function setRecording(patch: Partial<RecordingSessionState>): void {
    recording.value = { ...recording.value, ...patch }
  }

  function applyRecordingResult(result: RecordingSaveResult): void {
    recording.value = { ...recording.value, state: 'done', videoPath: result.path, bytes: result.bytes }
  }

  return {
    scenes, hydrated, saveError, isPresenting, recording,
    hydrate, persist, addScene, updateScene, removeScene, moveScene, setPresenting, setRecording, applyRecordingResult
  }
})
