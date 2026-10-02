import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ContourLine, GridBounds, ProfileSample } from '@renderer/utils/geo'

export type TerrainLabPhase = 'idle' | 'selecting' | 'sampling' | 'ready' | 'drawingProfile'

export interface TerrainLabApi {
  startSelection: () => void
  cancelSelection: () => void
  startProfile: () => void
  finishProfile: () => void
  clearProfile: () => void
  removeModel: () => void
  resample: () => void
  getContours: () => ContourLine[]
}

export interface TerrainLabStats {
  minElevation: number
  maxElevation: number
  areaKm2: number
  widthKm: number
  heightKm: number
}

export const useTerrainLabStore = defineStore('terrainLab', () => {
  const panelOpen = ref(false)
  const phase = ref<TerrainLabPhase>('idle')
  const bounds = ref<GridBounds | null>(null)
  const stats = ref<TerrainLabStats | null>(null)
  const exaggeration = ref(2)
  const contourInterval = ref(0)
  const slopeAnalysis = ref(false)
  const profilePoints = ref<Array<[number, number]>>([])
  const profile = ref<ProfileSample[] | null>(null)
  const error = ref('')

  let lab: TerrainLabApi | null = null

  function registerLab(api: TerrainLabApi): void {
    lab = api
  }

  function setPanelOpen(value: boolean): void {
    panelOpen.value = value
  }

  function beginSelection(): void {
    phase.value = 'selecting'
    error.value = ''
    profilePoints.value = []
    profile.value = null
  }

  function setBounds(value: GridBounds): void {
    bounds.value = value
    phase.value = 'sampling'
  }

  function setStats(value: TerrainLabStats): void {
    stats.value = value
  }

  function setError(message: string): void {
    error.value = message
    if (phase.value === 'sampling') phase.value = bounds.value ? 'ready' : 'idle'
  }

  function setReady(): void {
    phase.value = 'ready'
  }

  function startSelection(): void {
    lab?.startSelection()
  }

  function cancelSelection(): void {
    lab?.cancelSelection()
  }

  function startProfile(): void {
    profile.value = null
    profilePoints.value = []
    phase.value = 'drawingProfile'
    lab?.startProfile()
  }

  function addProfilePoint(point: [number, number]): void {
    profilePoints.value = [...profilePoints.value, point]
  }

  function finishProfile(): void {
    if (profilePoints.value.length < 2) return
    lab?.finishProfile()
    if (phase.value === 'drawingProfile') phase.value = 'ready'
  }

  function cancelProfile(): void {
    profilePoints.value = []
    if (phase.value === 'drawingProfile') phase.value = 'ready'
  }

  function setProfile(samples: ProfileSample[]): void {
    profile.value = samples
    phase.value = 'ready'
  }

  function clearProfile(): void {
    profilePoints.value = []
    profile.value = null
    lab?.clearProfile()
  }

  function removeModel(): void {
    lab?.removeModel()
    bounds.value = null
    stats.value = null
    profilePoints.value = []
    profile.value = null
    error.value = ''
    phase.value = 'idle'
  }

  function resample(): void {
    lab?.resample()
  }

  function getContours(): ContourLine[] {
    return lab?.getContours() ?? []
  }

  return {
    panelOpen, phase, bounds, stats, exaggeration, contourInterval, slopeAnalysis, profilePoints, profile, error,
    registerLab, setPanelOpen, beginSelection, setBounds, setStats, setError, setReady,
    startSelection, cancelSelection, startProfile, addProfilePoint, finishProfile, cancelProfile,
    setProfile, clearProfile, removeModel, resample, getContours
  }
})
