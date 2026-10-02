import { onBeforeUnmount, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { useTectonicStore } from '@renderer/stores/tectonic'
import {
  BOUNDARY_COLORS,
  earthquakeLabel,
  earthquakePixelSize,
  MAJOR_VOLCANOES,
  NOTABLE_EARTHQUAKES,
  PLATE_BOUNDARIES
} from '@renderer/utils/tectonicData'

const BOUNDARY_ALTITUDE = 2000

export function useTectonicLayer(viewerRef: Ref<Cesium.Viewer | undefined>) {
  const store = useTectonicStore()
  let built = false
  let boundaryCollection: Cesium.PolylineCollection | null = null
  let volcanoCollection: Cesium.PointPrimitiveCollection | null = null
  let volcanoLabels: Cesium.LabelCollection | null = null
  let quakeCollection: Cesium.PointPrimitiveCollection | null = null
  let quakeLabels: Cesium.LabelCollection | null = null

  function currentViewer(): Cesium.Viewer | null {
    const viewer = viewerRef.value
    return viewer && !viewer.isDestroyed() ? viewer : null
  }

  function buildBoundaries(viewer: Cesium.Viewer): void {
    const collection = viewer.scene.primitives.add(new Cesium.PolylineCollection())
    if (!collection) return
    boundaryCollection = collection
    for (const boundary of PLATE_BOUNDARIES) {
      collection.add({
        positions: boundary.path.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, BOUNDARY_ALTITUDE)),
        width: 3,
        material: Cesium.Material.fromType('Color', {
          color: Cesium.Color.fromCssColorString(BOUNDARY_COLORS[boundary.kind]).withAlpha(0.9)
        })
      })
    }
  }

  function buildVolcanoes(viewer: Cesium.Viewer): void {
    const points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection())
    const labels = viewer.scene.primitives.add(new Cesium.LabelCollection())
    if (!points || !labels) return
    volcanoCollection = points
    volcanoLabels = labels
    for (const volcano of MAJOR_VOLCANOES) {
      const position = Cesium.Cartesian3.fromDegrees(volcano.lon, volcano.lat)
      points.add({
        position,
        pixelSize: 9,
        color: Cesium.Color.fromCssColorString('#fa8c16'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1.5,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      })
      labels.add({
        position,
        text: volcano.name,
        font: '12px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#fa8c16'),
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
        outlineWidth: 3,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        scale: 0.9,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      })
    }
  }

  function buildQuakes(viewer: Cesium.Viewer): void {
    const points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection())
    const labels = viewer.scene.primitives.add(new Cesium.LabelCollection())
    if (!points || !labels) return
    quakeCollection = points
    quakeLabels = labels
    for (const quake of NOTABLE_EARTHQUAKES) {
      const position = Cesium.Cartesian3.fromDegrees(quake.lon, quake.lat)
      points.add({
        position,
        pixelSize: earthquakePixelSize(quake.magnitude),
        color: Cesium.Color.fromCssColorString('#d4380d').withAlpha(0.75),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1.5,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      })
      labels.add({
        position,
        text: earthquakeLabel(quake),
        font: '11px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#d4380d'),
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
        outlineWidth: 3,
        pixelOffset: new Cesium.Cartesian2(0, 14),
        scale: 0.9,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      })
    }
  }

  function build(viewer: Cesium.Viewer): void {
    built = true
    buildBoundaries(viewer)
    buildVolcanoes(viewer)
    buildQuakes(viewer)
    applyVisibility()
  }

  function applyVisibility(): void {
    if (boundaryCollection) boundaryCollection.show = store.showBoundaries
    if (volcanoCollection) volcanoCollection.show = store.showVolcanoes
    if (volcanoLabels) volcanoLabels.show = store.showVolcanoes
    if (quakeCollection) quakeCollection.show = store.showQuakes
    if (quakeLabels) quakeLabels.show = store.showQuakes
  }

  watch(viewerRef, (viewer) => {
    if (viewer && !built && store.panelOpen) build(viewer)
  })

  watch(() => store.panelOpen, (open) => {
    const viewer = currentViewer()
    if (open && viewer && !built) build(viewer)
  })

  watch([() => store.showBoundaries, () => store.showVolcanoes, () => store.showQuakes], applyVisibility)

  onBeforeUnmount(() => {
    const viewer = currentViewer()
    if (!viewer) return
    if (boundaryCollection) viewer.scene.primitives.remove(boundaryCollection)
    if (volcanoCollection) viewer.scene.primitives.remove(volcanoCollection)
    if (volcanoLabels) viewer.scene.primitives.remove(volcanoLabels)
    if (quakeCollection) viewer.scene.primitives.remove(quakeCollection)
    if (quakeLabels) viewer.scene.primitives.remove(quakeLabels)
    boundaryCollection = null
    volcanoCollection = null
    volcanoLabels = null
    quakeCollection = null
    quakeLabels = null
  })
}
