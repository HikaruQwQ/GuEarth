import { computed, onBeforeUnmount, onMounted, watch, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import { useGlobeStore } from '@renderer/stores/globe'
import { useClimateStore } from '@renderer/stores/climate'
import { useSolarStore } from '@renderer/stores/solar'

const TOOLBAR_RESERVE = 80
const TIMELINE_RESERVE = 84
const SOLAR_RESERVE = 130

export function useGlobeFraming(viewer: ShallowRef<Cesium.Viewer | undefined>) {
  const globeStore = useGlobeStore()
  const climateStore = useClimateStore()
  const solarStore = useSolarStore()

  const reservePx = computed(() => {
    let value = TOOLBAR_RESERVE
    if (climateStore.hasActiveOverlay) value += TIMELINE_RESERVE
    if (solarStore.active) value += SOLAR_RESERVE
    return value
  })
  let appliedOffset: Cesium.Cartesian3 | null = null
  let moveEndRemoval: (() => void) | null = null

  function reframe(): void {
    const currentViewer = viewer.value
    if (!currentViewer || currentViewer.isDestroyed()) return
    if (currentViewer.scene.mode !== Cesium.SceneMode.SCENE3D) {
      appliedOffset = null
      return
    }
    const shiftPx = reservePx.value / 2
    const canvas = currentViewer.canvas
    const centerY = canvas.clientHeight / 2
    const centerX = canvas.clientWidth / 2
    const center = currentViewer.camera.pickEllipsoid(new Cesium.Cartesian2(centerX, centerY), currentViewer.scene.globe.ellipsoid)
    const above = currentViewer.camera.pickEllipsoid(new Cesium.Cartesian2(centerX, centerY - 1), currentViewer.scene.globe.ellipsoid)
    if (!center || !above) return
    const metersPerPixel = Cesium.Cartesian3.distance(center, above)
    if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return
    if (appliedOffset) {
      currentViewer.camera.move(Cesium.Cartesian3.negate(appliedOffset, new Cesium.Cartesian3()), 1)
      appliedOffset = null
    }
    if (shiftPx > 0) {
      const offset = Cesium.Cartesian3.multiplyByScalar(currentViewer.camera.up, -metersPerPixel * shiftPx, new Cesium.Cartesian3())
      currentViewer.camera.move(offset, 1)
      appliedOffset = offset
    }
  }

  function attachMoveEnd(currentViewer: Cesium.Viewer | undefined): void {
    moveEndRemoval?.()
    moveEndRemoval = null
    if (!currentViewer || currentViewer.isDestroyed()) return
    const listener = () => reframe()
    currentViewer.camera.moveEnd.addEventListener(listener)
    moveEndRemoval = () => currentViewer.camera.moveEnd.removeEventListener(listener)
  }

  watch(() => viewer.value, (currentViewer) => attachMoveEnd(currentViewer), { immediate: true })
  watch([reservePx, () => globeStore.isGlobeReady], () => reframe())
  onMounted(() => window.addEventListener('resize', reframe))
  onBeforeUnmount(() => {
    window.removeEventListener('resize', reframe)
    moveEndRemoval?.()
    moveEndRemoval = null
  })
}
