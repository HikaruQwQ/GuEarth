import { computed, ref, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { defineStore } from 'pinia'
import { findTeachingLayer, listTeachingLayers, type TeachingLayerDefinition, type TeachingLayerHandle } from '@renderer/teaching/registry'
import type { LegendSection } from '@renderer/utils/legendEntries'

export const useTeachingStore = defineStore('teaching', () => {
  const definitions = ref<TeachingLayerDefinition[]>([])
  const visibility = ref<Record<string, boolean>>({})
  const handles = new Map<string, TeachingLayerHandle>()
  let viewer: Cesium.Viewer | undefined

  const legendSections = computed<LegendSection[]>(() =>
    definitions.value
      .filter((definition) => visibility.value[definition.id] && definition.legend?.length)
      .map((definition) => ({ id: definition.id, title: definition.name, items: definition.legend ?? [] }))
  )

  function refreshDefinitions(): void {
    definitions.value = listTeachingLayers()
  }

  function ensureHandle(id: string): TeachingLayerHandle | undefined {
    const existing = handles.get(id)
    if (existing) return existing
    const definition = findTeachingLayer(id)
    if (!definition || !viewer) return undefined
    const handle = definition.create(viewer)
    handles.set(id, handle)
    return handle
  }

  function setLayerVisible(id: string, visible: boolean): void {
    visibility.value = { ...visibility.value, [id]: visible }
    if (!visible) {
      handles.get(id)?.setVisible(false)
      return
    }
    ensureHandle(id)?.setVisible(true)
  }

  function toggleLayer(id: string): void {
    setLayerVisible(id, !visibility.value[id])
  }

  function isLayerVisible(id: string): boolean {
    return visibility.value[id] === true
  }

  function bindViewer(viewerRef: Ref<Cesium.Viewer | undefined>): void {
    watch(
      viewerRef,
      (current, previous) => {
        if (previous && !previous.isDestroyed()) {
          for (const handle of handles.values()) handle.dispose()
          handles.clear()
        }
        viewer = current && !current.isDestroyed() ? current : undefined
        if (!viewer) return
        for (const [id, visible] of Object.entries(visibility.value)) {
          if (visible) ensureHandle(id)
        }
      },
      { flush: 'post' }
    )
  }

  return { definitions, visibility, legendSections, refreshDefinitions, setLayerVisible, toggleLayer, isLayerVisible, bindViewer }
})
