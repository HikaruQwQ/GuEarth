import { onBeforeUnmount } from 'vue'
import * as Cesium from 'cesium'
import type { Ref } from 'vue'

export function useMarkers(viewerRef: Ref<Cesium.Viewer | undefined>) {
  let marker: Cesium.Entity | null = null

  function currentViewer(): Cesium.Viewer | null {
    const viewer = viewerRef.value
    return viewer && !viewer.isDestroyed() ? viewer : null
  }

  function dropMarker(lon: number, lat: number, name: string): void {
    const viewer = currentViewer()
    if (!viewer) return
    if (marker) viewer.entities.remove(marker)
    marker = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: {
        pixelSize: 12,
        color: Cesium.Color.fromCssColorString('#fa541c'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: name,
        font: '13px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.88)'),
        showBackground: true,
        backgroundColor: Cesium.Color.WHITE.withAlpha(0.85),
        backgroundPadding: new Cesium.Cartesian2(6, 4),
        pixelOffset: new Cesium.Cartesian2(0, -20),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    })
  }

  function clearMarker(): void {
    const viewer = currentViewer()
    if (viewer && marker) viewer.entities.remove(marker)
    marker = null
  }

  onBeforeUnmount(clearMarker)

  return { dropMarker, clearMarker }
}
