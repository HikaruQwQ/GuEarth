import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ShapeKind = 'point' | 'polyline' | 'polygon'
export type DrawTool = 'point' | 'line' | 'polygon' | 'distance' | 'area'

export interface GeoPosition {
  longitude: number
  latitude: number
  height: number
}

export interface DrawnShape {
  id: string
  kind: ShapeKind
  positions: GeoPosition[]
  annotation: string
  createdAt: number
}

function apiAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.guEarth?.annotations)
}

export const useDrawingStore = defineStore('drawing', () => {
  const shapes = ref<DrawnShape[]>([])
  const activeTool = ref<DrawTool | null>(null)
  const selectedShapeId = ref<string | null>(null)

  async function load(): Promise<void> {
    if (!apiAvailable()) return
    shapes.value = await window.guEarth.annotations.list()
  }

  function setActiveTool(tool: DrawTool | null): void {
    activeTool.value = tool
  }

  function setSelectedShapeId(id: string | null): void {
    selectedShapeId.value = id
  }

  function addShape(shape: DrawnShape): void {
    shapes.value = [...shapes.value, shape]
    if (apiAvailable()) void window.guEarth.annotations.save(shape)
  }

  function updateAnnotation(id: string, annotation: string): void {
    const shape = shapes.value.find((item) => item.id === id)
    if (!shape) return
    shape.annotation = annotation
    if (apiAvailable()) void window.guEarth.annotations.save(shape)
  }

  function removeShape(id: string): void {
    shapes.value = shapes.value.filter((item) => item.id !== id)
    if (selectedShapeId.value === id) selectedShapeId.value = null
    if (apiAvailable()) void window.guEarth.annotations.remove(id)
  }

  function clearAll(): void {
    const ids = shapes.value.map((shape) => shape.id)
    shapes.value = []
    selectedShapeId.value = null
    if (apiAvailable()) for (const id of ids) void window.guEarth.annotations.remove(id)
  }

  return { shapes, activeTool, selectedShapeId, load, setActiveTool, setSelectedShapeId, addShape, updateAnnotation, removeShape, clearAll }
})
