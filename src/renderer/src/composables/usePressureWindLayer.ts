import { onBeforeUnmount, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { useMonsoonStore } from '@renderer/stores/monsoon'
import {
  BELT_COLORS,
  beltLatRange,
  PRESSURE_BELTS,
  windBeltArrows,
  WIND_KIND_COLORS,
  type WindArrowPath
} from '@renderer/utils/pressureWindData'

const BELT_ALTITUDE = 3000
const ARROW_ALTITUDE = 4500

export function usePressureWindLayer(viewerRef: Ref<Cesium.Viewer | undefined>) {
  const store = useMonsoonStore()
  let built = false
  const beltEntities: Cesium.Entity[] = []
  let arrowCollection: Cesium.PolylineCollection | null = null
  const arrowPaths: WindArrowPath[] = []
  const arrowPolylines: Cesium.Polyline[] = []

  function currentViewer(): Cesium.Viewer | null {
    const viewer = viewerRef.value
    return viewer && !viewer.isDestroyed() ? viewer : null
  }

  function buildBelts(viewer: Cesium.Viewer): void {
    for (const belt of PRESSURE_BELTS) {
      beltEntities.push(
        viewer.entities.add({
          rectangle: {
            coordinates: new Cesium.CallbackProperty(() => {
              const range = beltLatRange(belt, store.monthPhase)
              return Cesium.Rectangle.fromDegrees(-180, range.south, 180, range.north)
            }, false),
            material: new Cesium.ColorMaterialProperty(
              new Cesium.CallbackProperty(() => Cesium.Color.fromCssColorString(BELT_COLORS[belt.kind]).withAlpha(0.16), false)
            ),
            height: BELT_ALTITUDE
          }
        })
      )
      beltEntities.push(
        viewer.entities.add({
          position: new Cesium.CallbackPositionProperty(() => {
            const range = beltLatRange(belt, store.monthPhase)
            return Cesium.Cartesian3.fromDegrees(belt.labelLon, (range.south + range.north) / 2, BELT_ALTITUDE + 1200)
          }, false),
          label: {
            text: belt.name,
            font: '12px sans-serif',
            fillColor: Cesium.Color.fromCssColorString(BELT_COLORS[belt.kind]),
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
            outlineWidth: 3,
            showBackground: true,
            backgroundColor: Cesium.Color.WHITE.withAlpha(0.82),
            backgroundPadding: new Cesium.Cartesian2(6, 3),
            scale: 0.9
          }
        })
      )
    }
  }

  function buildArrows(viewer: Cesium.Viewer): void {
    const collection = viewer.scene.primitives.add(new Cesium.PolylineCollection())
    if (!collection) return
    arrowCollection = collection
    arrowPaths.push(...windBeltArrows(store.monthPhase))
    for (const arrow of arrowPaths) {
      arrowPolylines.push(
        collection.add({
          positions: arrow.path.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, ARROW_ALTITUDE)),
          width: 13,
          material: Cesium.Material.fromType('PolylineArrow', { color: Cesium.Color.fromCssColorString(WIND_KIND_COLORS[arrow.kind]) })
        })
      )
    }
  }

  function refreshArrows(): void {
    const next = windBeltArrows(store.monthPhase)
    for (let i = 0; i < arrowPolylines.length; i++) {
      arrowPaths[i] = next[i]
      arrowPolylines[i].positions = next[i].path.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, ARROW_ALTITUDE))
    }
  }

  function build(viewer: Cesium.Viewer): void {
    built = true
    buildBelts(viewer)
    buildArrows(viewer)
    applyVisibility()
  }

  function applyVisibility(): void {
    for (const entity of beltEntities) entity.show = store.showPressureBelts
    if (arrowCollection) arrowCollection.show = store.showWindBelts
  }

  watch(viewerRef, (viewer) => {
    if (viewer && !built && store.panelOpen) build(viewer)
  })

  watch(() => store.panelOpen, (open) => {
    const viewer = currentViewer()
    if (open && viewer && !built) build(viewer)
  })

  watch(() => store.monthPhase, () => {
    if (built) refreshArrows()
  })

  watch([() => store.showPressureBelts, () => store.showWindBelts], applyVisibility)

  onBeforeUnmount(() => {
    const viewer = currentViewer()
    if (!viewer) return
    for (const entity of beltEntities) viewer.entities.remove(entity)
    if (arrowCollection) viewer.scene.primitives.remove(arrowCollection)
    beltEntities.length = 0
    arrowCollection = null
    arrowPaths.length = 0
    arrowPolylines.length = 0
  })
}
