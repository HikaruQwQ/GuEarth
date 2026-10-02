import type * as Cesium from 'cesium'

export type TeachingLegendShape = 'line' | 'dash' | 'dot' | 'arrow' | 'fill'

export interface TeachingLegendItem {
  color: string
  label: string
  shape: TeachingLegendShape
}

export interface TeachingLayerHandle {
  setVisible(visible: boolean): void
  dispose(): void
}

export type TeachingLayerCategory = 'skills' | 'nature' | 'human'

export interface TeachingLayerDefinition {
  id: string
  name: string
  category: TeachingLayerCategory
  description?: string
  legend?: TeachingLegendItem[]
  flyTo?: { longitude: number; latitude: number; height: number }
  create(viewer: Cesium.Viewer): TeachingLayerHandle
}

const registry = new Map<string, TeachingLayerDefinition>()

export function registerTeachingLayer(definition: TeachingLayerDefinition): void {
  registry.set(definition.id, definition)
}

export function listTeachingLayers(): TeachingLayerDefinition[] {
  return [...registry.values()]
}

export function findTeachingLayer(idOrName: string): TeachingLayerDefinition | undefined {
  return registry.get(idOrName) ?? [...registry.values()].find((layer) => layer.name === idOrName)
}
