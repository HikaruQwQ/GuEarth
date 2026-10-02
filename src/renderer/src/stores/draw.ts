import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { AnnotationData } from '../../../preload/types'
import { autoAnnotationName } from '@renderer/utils/measure'

export type DrawMode = 'none' | 'point' | 'line' | 'polygon'

let annotationSeq = 0

export type FlyCapability = (lon: number, lat: number, height: number) => void

export const useDrawStore = defineStore('draw', () => {
  const panelOpen = ref(false)
  const mode = ref<DrawMode>('none')
  const draftPoints = ref<Array<[number, number]>>([])
  const annotations = ref<AnnotationData[]>([])
  const loaded = ref(false)

  let flyTo: FlyCapability | null = null

  function registerFly(value: FlyCapability): void {
    flyTo = value
  }

  function locate(points: Array<[number, number]>, kind: 'point' | 'line' | 'polygon'): void {
    if (!flyTo) return
    const target = kind === 'point' ? points[0] : points[Math.floor(points.length / 2)]
    flyTo(target[0], target[1], kind === 'point' ? 800000 : 2500000)
  }

  function setPanelOpen(value: boolean): void {
    panelOpen.value = value
  }

  function setMode(value: DrawMode): void {
    mode.value = value
    draftPoints.value = []
  }

  function addDraftPoint(point: [number, number]): void {
    draftPoints.value = [...draftPoints.value, point]
  }

  function resetDraft(): void {
    draftPoints.value = []
  }

  async function hydrate(): Promise<void> {
    if (loaded.value) return
    try {
      annotations.value = await window.guEarth.annotations.list()
      loaded.value = true
    } catch {
      annotations.value = []
    }
  }

  async function addAnnotation(kind: 'point' | 'line' | 'polygon', points: Array<[number, number]>, distanceKm: number | null, areaKm2: number | null): Promise<AnnotationData> {
    const annotation: AnnotationData = {
      id: `anno-${Date.now()}-${++annotationSeq}`,
      kind,
      name: autoAnnotationName(kind, annotations.value.length + 1),
      points,
      distanceKm,
      areaKm2,
      createdAt: Date.now()
    }
    annotations.value = [...annotations.value, annotation]
    try {
      await window.guEarth.annotations.add(annotation)
    } catch {
      annotations.value = annotations.value.filter((item) => item.id !== annotation.id)
      throw new Error('标注保存失败')
    }
    return annotation
  }

  async function removeAnnotation(id: string): Promise<void> {
    const previous = annotations.value
    annotations.value = previous.filter((item) => item.id !== id)
    try {
      await window.guEarth.annotations.remove(id)
    } catch {
      annotations.value = previous
      throw new Error('标注删除失败')
    }
  }

  return {
    panelOpen, mode, draftPoints, annotations, loaded,
    setPanelOpen, setMode, addDraftPoint, resetDraft, hydrate, addAnnotation, removeAnnotation,
    registerFly, locate
  }
})
