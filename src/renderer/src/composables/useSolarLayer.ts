import { onBeforeUnmount, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { useSolarStore, parseIsoDate } from '@renderer/stores/solar'
import { subsolarPoint, terminatorRing } from '@renderer/utils/solar'

const TERMINATOR_ALTITUDE = 2000
const SUBSOLAR_ALTITUDE = 0

export function useSolarLayer(viewerRef: Ref<Cesium.Viewer | undefined>) {
  const store = useSolarStore()
  let built = false
  let terminatorEntity: Cesium.Entity | null = null
  let subsolarEntity: Cesium.Entity | null = null
  let lastFrame = 0
  let removePreUpdate: (() => void) | null = null

  function currentViewer(): Cesium.Viewer | null {
    const viewer = viewerRef.value
    return viewer && !viewer.isDestroyed() ? viewer : null
  }

  function currentInput() {
    return parseIsoDate(store.dateISO)
  }

  function build(viewer: Cesium.Viewer): void {
    built = true
    terminatorEntity = viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const point = subsolarPoint(currentInput(), store.utcHours)
          return Cesium.Cartesian3.fromDegreesArray(terminatorRing(point.latitude, point.longitude, 3).flat())
        }, false),
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.WHITE.withAlpha(0.95),
          dashLength: 18
        })
      }
    })
    subsolarEntity = viewer.entities.add({
      position: new Cesium.CallbackPositionProperty(() => {
        const point = subsolarPoint(currentInput(), store.utcHours)
        return Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, SUBSOLAR_ALTITUDE)
      }, false),
      point: {
        pixelSize: 12,
        color: Cesium.Color.fromCssColorString('#faad14'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: '太阳直射点',
        font: '12px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#faad14'),
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        pixelOffset: new Cesium.Cartesian2(0, -14),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    })
    applyClock(viewer)
    applyVisibility()
    const callback = (): void => tick()
    viewer.scene.preUpdate.addEventListener(callback)
    removePreUpdate = () => viewer.scene.preUpdate.removeEventListener(callback)
  }

  function applyClock(viewer: Cesium.Viewer): void {
    const input = currentInput()
    const date = new Date(Date.UTC(input.year, input.month - 1, input.day, 0, 0, 0))
    date.setUTCSeconds(store.utcHours * 3600)
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(date)
    viewer.clock.shouldAnimate = false
  }

  function tick(): void {
    const now = performance.now()
    const dt = Math.min(0.12, Math.max(0.001, (now - lastFrame) / 1000))
    lastFrame = now
    if (!store.playing) return
    store.advanceTime(dt * store.speed)
  }

  function applyVisibility(): void {
    if (terminatorEntity) terminatorEntity.show = store.showTerminator
    if (subsolarEntity) subsolarEntity.show = store.showSubsolar
    const viewer = currentViewer()
    if (viewer && built) viewer.scene.globe.enableLighting = store.showLighting
  }

  watch(viewerRef, (viewer) => {
    if (viewer && !built && store.panelOpen) build(viewer)
  })

  watch(() => store.panelOpen, (open) => {
    const viewer = currentViewer()
    if (open && viewer && !built) build(viewer)
  })

  watch([() => store.dateISO, () => store.utcHours], () => {
    const viewer = currentViewer()
    if (viewer && built) applyClock(viewer)
  })

  watch([() => store.showTerminator, () => store.showSubsolar, () => store.showLighting], applyVisibility)

  onBeforeUnmount(() => {
    removePreUpdate?.()
    const viewer = currentViewer()
    if (!viewer) return
    if (terminatorEntity) viewer.entities.remove(terminatorEntity)
    if (subsolarEntity) viewer.entities.remove(subsolarEntity)
    terminatorEntity = null
    subsolarEntity = null
    viewer.scene.globe.enableLighting = false
    viewer.clock.shouldAnimate = true
  })
}
