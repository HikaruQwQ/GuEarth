import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'

export interface ScaleBarReadout {
  label: string
  widthPx: number
}

const NICE_STEPS = [1, 2, 5]

function pickScale(metersPerPixel: number): { meters: number; widthPx: number } {
  let fallback = { meters: NICE_STEPS[0], widthPx: 1 }
  let fallbackDistance = Number.POSITIVE_INFINITY
  for (let exponent = 0; exponent <= 7; exponent++) {
    const multiplier = 10 ** exponent
    for (const step of NICE_STEPS) {
      const meters = step * multiplier
      const widthPx = meters / metersPerPixel
      if (widthPx >= 60 && widthPx <= 170) return { meters, widthPx: Math.round(widthPx) }
      const distance = Math.abs(widthPx - 110)
      if (distance < fallbackDistance) {
        fallback = { meters, widthPx: Math.round(widthPx) }
        fallbackDistance = distance
      }
    }
  }
  return fallback
}

function formatScaleLabel(meters: number): string {
  if (meters < 1000) return `${meters} m`
  const km = meters / 1000
  return `${km % 1 === 0 ? km : km.toFixed(1)} km`
}

export function useScaleBar(viewerRef: Ref<Cesium.Viewer | undefined>) {
  const scale = ref<ScaleBarReadout | null>(null)
  let detach: (() => void) | null = null

  function compute(): void {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed()) {
      scale.value = null
      return
    }
    const width = viewer.canvas.clientWidth
    const height = viewer.canvas.clientHeight
    const center = new Cesium.Cartesian2(width / 2, height / 2)
    const left = new Cesium.Cartesian2(width / 2 - 40, height / 2)
    const pick = (position: Cesium.Cartesian2): Cesium.Cartesian3 | null => {
      const ray = viewer.camera.getPickRay(position)
      return ray ? viewer.scene.globe.pick(ray, viewer.scene) ?? null : null
    }
    const centerPoint = pick(center)
    const leftPoint = pick(left)
    if (!centerPoint || !leftPoint) {
      scale.value = null
      return
    }
    const metersPerPixel = Cesium.Cartesian3.distance(centerPoint, leftPoint) / 80
    if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) {
      scale.value = null
      return
    }
    const picked = pickScale(metersPerPixel)
    scale.value = { label: formatScaleLabel(picked.meters), widthPx: Math.min(picked.widthPx, 140) }
  }

  watch(viewerRef, (viewer) => {
    detach?.()
    detach = null
    if (!viewer) {
      scale.value = null
      return
    }
    const onMoveEnd = (): void => compute()
    viewer.camera.moveEnd.addEventListener(onMoveEnd)
    const onResize = (): void => compute()
    window.addEventListener('resize', onResize)
    compute()
    detach = () => {
      if (!viewer.isDestroyed()) viewer.camera.moveEnd.removeEventListener(onMoveEnd)
      window.removeEventListener('resize', onResize)
    }
  })

  onBeforeUnmount(() => {
    detach?.()
    detach = null
  })

  return { scale }
}
