import { onBeforeUnmount, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { useDrawStore } from '@renderer/stores/draw'
import { formatAreaKm2, pathLengthKm, ringCentroid, sphericalPolygonAreaKm2 } from '@renderer/utils/measure'
import type { AnnotationData } from '../../../preload/types'

const DRAW_COLOR = '#1677ff'
const DRAFT_COLOR = '#fa8c16'

function kmLabel(km: number): string {
  return `${km < 100 ? km.toFixed(1) : Math.round(km).toLocaleString()} km`
}

export function useDrawLayer(viewerRef: Ref<Cesium.Viewer | undefined>) {
  const store = useDrawStore()
  let handler: Cesium.ScreenSpaceEventHandler | null = null
  let built = false
  let draftPolyline: Cesium.Entity | null = null
  let draftPoints: Cesium.PointPrimitiveCollection | null = null
  const shapeEntities = new Map<string, Cesium.Entity[]>()

  function currentViewer(): Cesium.Viewer | null {
    const viewer = viewerRef.value
    return viewer && !viewer.isDestroyed() ? viewer : null
  }

  function buildDraftEntities(viewer: Cesium.Viewer): void {
    draftPolyline = viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const points = store.draftPoints
          if (points.length < 2) return []
          const ring = store.mode === 'polygon' && points.length >= 3 ? [...points, points[0]] : points
          return Cesium.Cartesian3.fromDegreesArray(ring.flat())
        }, false),
        width: 3,
        clampToGround: true,
        material: new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.fromCssColorString(DRAFT_COLOR), dashLength: 16 })
      }
    })
    draftPoints = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection())
    if (draftPoints) draftPoints.show = false
  }

  function syncDraftPoints(): void {
    if (!draftPoints) return
    draftPoints.removeAll()
    for (const [lon, lat] of store.draftPoints) {
      draftPoints.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        pixelSize: 8,
        color: Cesium.Color.fromCssColorString(DRAW_COLOR),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1.5,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      })
    }
    draftPoints.show = store.mode !== 'none' && store.draftPoints.length > 0
  }

  function createShapeEntities(viewer: Cesium.Viewer, annotation: AnnotationData): Cesium.Entity[] {
    const entities: Cesium.Entity[] = []
    const color = Cesium.Color.fromCssColorString(DRAW_COLOR)
    if (annotation.kind === 'point') {
      const [lon, lat] = annotation.points[0]
      entities.push(
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          point: { pixelSize: 10, color, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
          label: {
            text: annotation.name,
            font: '12px sans-serif',
            fillColor: Cesium.Color.WHITE,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
            outlineWidth: 3,
            pixelOffset: new Cesium.Cartesian2(0, -16),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          }
        })
      )
    }
    if (annotation.kind === 'line') {
      const end = annotation.points[annotation.points.length - 1]
      entities.push(
        viewer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(annotation.points.flat()),
            width: 3,
            clampToGround: true,
            material: color
          }
        })
      )
      entities.push(
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(end[0], end[1]),
          label: {
            text: `${annotation.name} · ${kmLabel(annotation.distanceKm ?? 0)}`,
            font: '12px sans-serif',
            fillColor: Cesium.Color.WHITE,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
            outlineWidth: 3,
            pixelOffset: new Cesium.Cartesian2(0, -14),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          }
        })
      )
    }
    if (annotation.kind === 'polygon') {
      const centroid = ringCentroid(annotation.points)
      entities.push(
        viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(annotation.points.flat())),
            material: color.withAlpha(0.28)
          }
        })
      )
      entities.push(
        viewer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([...annotation.points, annotation.points[0]].flat()),
            width: 2.5,
            clampToGround: true,
            material: color
          }
        })
      )
      entities.push(
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(centroid[0], centroid[1]),
          label: {
            text: `${annotation.name} · ${formatAreaKm2(annotation.areaKm2 ?? 0)}`,
            font: '12px sans-serif',
            fillColor: Cesium.Color.WHITE,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
            outlineWidth: 3,
            pixelOffset: new Cesium.Cartesian2(0, -14),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          }
        })
      )
    }
    return entities
  }

  function syncShapeEntities(): void {
    const viewer = currentViewer()
    if (!viewer) return
    const active = new Set(store.annotations.map((annotation) => annotation.id))
    for (const [id, entities] of shapeEntities) {
      if (active.has(id)) continue
      for (const entity of entities) viewer.entities.remove(entity)
      shapeEntities.delete(id)
    }
    for (const annotation of store.annotations) {
      if (shapeEntities.has(annotation.id)) continue
      shapeEntities.set(annotation.id, createShapeEntities(viewer, annotation))
    }
  }

  function finishDraft(): void {
    const mode = store.mode
    const points = store.draftPoints
    if (mode === 'line' && points.length >= 2) {
      const distanceKm = pathLengthKm(points)
      void store.addAnnotation('line', points, distanceKm, null)
      store.resetDraft()
      return
    }
    if (mode === 'polygon' && points.length >= 3) {
      const areaKm2 = sphericalPolygonAreaKm2(points)
      void store.addAnnotation('polygon', points, null, areaKm2)
      store.resetDraft()
      return
    }
    store.resetDraft()
  }

  function handleClick(click: Cesium.ScreenSpaceEventHandler.PositionedEvent): void {
    const viewer = currentViewer()
    if (!viewer || store.mode === 'none') return
    const cartesian = viewer.camera.pickEllipsoid(click.position, Cesium.Ellipsoid.WGS84)
    if (!cartesian) return
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
    const lon = Number(Cesium.Math.toDegrees(cartographic.longitude).toFixed(4))
    const lat = Number(Cesium.Math.toDegrees(cartographic.latitude).toFixed(4))
    if (store.mode === 'point') {
      void store.addAnnotation('point', [[lon, lat]], null, null)
      return
    }
    store.addDraftPoint([lon, lat])
  }

  function handleDoubleClick(): void {
    if (store.mode === 'none') return
    store.draftPoints = store.draftPoints.slice(0, -2)
    finishDraft()
  }

  function handleEscape(): void {
    if (store.mode === 'none' && !store.draftPoints.length) return
    store.resetDraft()
    store.setMode('none')
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return
    handleEscape()
  }

  function build(viewer: Cesium.Viewer): void {
    built = true
    viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas)
    handler.setInputAction(handleClick, Cesium.ScreenSpaceEventType.LEFT_CLICK)
    handler.setInputAction(handleDoubleClick, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    handler.setInputAction(finishDraft, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    window.addEventListener('keydown', handleKeydown)
    buildDraftEntities(viewer)
    void store.hydrate().then(syncShapeEntities)
  }

  watch(viewerRef, (viewer) => {
    if (viewer && !built) build(viewer)
  })

  watch(() => store.panelOpen, (open) => {
    if (open) return
    store.setMode('none')
    store.resetDraft()
  })

  watch(() => [store.mode, [...store.draftPoints]], syncDraftPoints)

  watch(() => store.annotations.map((annotation) => annotation.id).join('|'), syncShapeEntities)

  onBeforeUnmount(() => {
    const viewer = currentViewer()
    handler?.destroy()
    handler = null
    window.removeEventListener('keydown', handleKeydown)
    if (!viewer) return
    if (draftPolyline) viewer.entities.remove(draftPolyline)
    if (draftPoints) viewer.scene.primitives.remove(draftPoints)
    for (const entities of shapeEntities.values()) {
      for (const entity of entities) viewer.entities.remove(entity)
    }
    shapeEntities.clear()
    draftPolyline = null
    draftPoints = null
  })
}
