import { Cartesian2 } from 'cesium'
import type { ShallowRef } from 'vue'
import type * as Cesium from 'cesium'

const started = performance.now()
const SAMPLE_SECONDS = 5

export function usePerfProbe(viewer: ShallowRef<Cesium.Viewer | undefined>): void {
  const marks = new Map<string, number>()
  let lastStage = ''
  let sawPendingTiles = false

  function hasVisibleSurface(current: Cesium.Viewer): boolean {
    const canvas = current.scene.canvas
    if (canvas.clientWidth < 2 || canvas.clientHeight < 2) return false
    const ray = current.camera.getPickRay(new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2))
    if (!ray) return false
    try {
      return current.scene.globe.pick(ray, current.scene) !== undefined
    } catch {
      return false
    }
  }

  function mark(name: string): void {
    if (marks.has(name)) return
    const now = performance.now()
    marks.set(name, now)
    console.log(`[perf] +${(now - started).toFixed(1)}ms @${now.toFixed(1)}ms ${name}`)
  }

  console.log(`[perf] t0 @${started.toFixed(1)}ms probe-module-eval`)
  mark('probe-mounted')

  const poll = window.setInterval(() => {
    const current = viewer.value
    const stage = document.querySelector('.globe-loading-stage')?.textContent ?? ''
    if (stage && stage !== lastStage) {
      lastStage = stage
      mark(`stage:${stage}`)
    }
    if (current && !current.isDestroyed()) {
      mark('viewer-created')
      if (current.scene.globe.show) mark('globe-shown')
      const centerHeight = current.scene.globe.getHeight(current.camera.positionCartographic)
      if (!marks.has('surface-visible') && hasVisibleSurface(current)) mark('surface-visible')
      if (current.terrainProvider.constructor.name !== 'EllipsoidTerrainProvider') {
        if (!marks.has('terrain-provider-active')) mark('terrain-provider-active')
        if (!marks.has('terrain-elevation-available') && centerHeight !== undefined && Math.abs(centerHeight) > 1) mark('terrain-elevation-available')
      }
      if (current.imageryLayers.length > 0) mark('imagery-attached')
    }
    if (!document.querySelector('.globe-loading')) mark('loading-dismissed')
  }, 100)
  window.setTimeout(() => window.clearInterval(poll), 120000)

  function attachTileProgress(current: Cesium.Viewer): void {
    current.scene.globe.tileLoadProgressEvent.addEventListener((pending: number) => {
      if (pending > 0) {
        sawPendingTiles = true
        mark('tiles-requested')
        return
      }
      if (sawPendingTiles) mark('tiles-settled')
    })
  }

  function sample(label: string): void {
    const current = viewer.value
    if (!current || current.isDestroyed()) {
      console.log(`[perf] ${label} no-viewer`)
      return
    }
    let frames = 0
    const off = current.scene.postRender.addEventListener(() => {
      frames += 1
    })
    window.setTimeout(() => {
      off()
      if (current.isDestroyed()) return
      const timeline = [...marks.entries()].map(([name, at]) => `${name}@${at.toFixed(0)}`).join(' ')
      console.log(`[perf] ${label} fps=${(frames / SAMPLE_SECONDS).toFixed(1)} timeline: ${timeline}`)
      const sources = current.dataSources
      for (let index = 0; index < sources.length; index += 1) {
        const source = sources.get(index)
        console.log(`[perf] ${label} datasource=${source.name || index} entities=${source.entities.values.length}`)
      }
      console.log(`[perf] ${label} viewer-entities=${current.entities.values.length} imagery=${current.imageryLayers.length} tilesLoaded=${current.scene.globe.tilesLoaded}`)
      console.log(`[perf] ${label} terrainProvider=${current.terrainProvider.constructor.name} centerHeight=${current.scene.globe.getHeight(current.camera.positionCartographic) ?? 'unavailable'}`)
      const memory = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
      if (memory) console.log(`[perf] ${label} jsHeap=${(memory.usedJSHeapSize / 1048576).toFixed(1)}MB total=${(memory.totalJSHeapSize / 1048576).toFixed(1)}MB`)
    }, SAMPLE_SECONDS * 1000)
  }

  const attach = window.setInterval(() => {
    const current = viewer.value
    if (!current || current.isDestroyed()) return
    window.clearInterval(attach)
    attachTileProgress(current)
    window.setTimeout(() => sample('t15'), 5000)
    window.setTimeout(() => sample('t60'), 45000)
  }, 100)
}
