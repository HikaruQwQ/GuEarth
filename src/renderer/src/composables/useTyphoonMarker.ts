import { onBeforeUnmount, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { useWeatherStore } from '@renderer/stores/weather'

export function useTyphoonMarker(viewerRef: Ref<Cesium.Viewer | undefined>) {
  const store = useWeatherStore()
  let marker: Cesium.Entity | null = null

  function currentViewer(): Cesium.Viewer | undefined {
    const viewer = viewerRef.value
    return viewer && !viewer.isDestroyed() ? viewer : undefined
  }

  function removeMarker(): void {
    const viewer = currentViewer()
    if (marker && viewer) viewer.entities.remove(marker)
    marker = null
  }

  function syncMarker(): void {
    const viewer = currentViewer()
    if (!viewer) return
    if (!store.panelOpen) {
      removeMarker()
      return
    }
    const point = store.typhoonPoint
    const readout = store.typhoonReadout
    const label = `${store.typhoon.name} ${readout.date}\n${readout.category} · ${readout.windMs} m/s`
    if (!marker) {
      marker = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 60000),
        point: {
          pixelSize: 14,
          color: Cesium.Color.fromCssColorString('#d4380d').withAlpha(0.9),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: label,
          font: '12px sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#d4380d'),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
          outlineWidth: 3,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      })
      return
    }
    marker.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 60000))
    if (marker.label) marker.label.text = new Cesium.ConstantProperty(label)
    if (marker.point) marker.point.pixelSize = new Cesium.ConstantProperty(10 + Math.round(readout.windMs / 6))
  }

  watch(() => [store.typhoonPoint, store.panelOpen, store.typhoonId], syncMarker, { deep: true })

  onBeforeUnmount(() => {
    removeMarker()
    store.setPanelOpen(false)
  })
}
