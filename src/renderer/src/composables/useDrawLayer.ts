import { onBeforeUnmount, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { useDrawStore } from '@renderer/stores/draw'
import { formatAreaKm2, formatDms, pathLengthKm, ringCentroid, sphericalPolygonAreaKm2 } from '@renderer/utils/measure'
import type { AnnotationData, AnnotationIcon, AnnotationStyle } from '../../../preload/types'

const DRAW_COLOR = '#1677ff'
const DRAFT_COLOR = '#fa8c16'
const DEFAULT_STYLE: AnnotationStyle = { color: DRAW_COLOR, lineWidth: 3, fillOpacity: 0.28, icon: 'circle', iconScale: 1 }

function kmLabel(km: number): string {
  return `${km < 100 ? km.toFixed(1) : Math.round(km).toLocaleString()} km`
}

const iconCache = new Map<string, string>()

function iconDataUrl(icon: AnnotationIcon, color: string): string {
  const key = `${icon}:${color}`
  const cached = iconCache.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 48
  canvas.height = 48
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.translate(24, 24)
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = 4
  ctx.beginPath()
  if (icon === 'triangle') {
    ctx.moveTo(0, -16)
    ctx.lineTo(15, 12)
    ctx.lineTo(-15, 12)
    ctx.closePath()
  } else if (icon === 'star') {
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? 17 : 7.5
      const angle = -Math.PI / 2 + (i * Math.PI) / 5
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  } else {
    ctx.moveTo(0, 18)
    ctx.bezierCurveTo(-14, 2, -16, -6, -16, -10)
    ctx.arc(0, -10, 16, Math.PI, 0, false)
    ctx.bezierCurveTo(16, -6, 14, 2, 0, 18)
    ctx.closePath()
  }
  ctx.fill()
  ctx.stroke()
  const url = canvas.toDataURL()
  iconCache.set(key, url)
  return url
}

function overlayUrl(overlay: { assetDir: string | null; fileName: string | null; remoteUrl: string | null }): string | null {
  if (overlay.remoteUrl) return overlay.remoteUrl
  if (overlay.assetDir && overlay.fileName) return `guearth-asset://${overlay.assetDir}/${encodeURIComponent(overlay.fileName)}`
  return null
}

export function useDrawLayer(viewerRef: Ref<Cesium.Viewer | undefined>) {
  const store = useDrawStore()
  let handler: Cesium.ScreenSpaceEventHandler | null = null
  let built = false
  let draftPolyline: Cesium.Entity | null = null
  let draftPoints: Cesium.PointPrimitiveCollection | null = null
  const shapeEntities = new Map<string, Cesium.Entity[]>()
  const overlayLayers = new Map<string, Cesium.ImageryLayer>()
  let overlayGeneration = 0

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

  function labelOptions(): Cesium.LabelGraphics.ConstructorOptions {
    return {
      font: '12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
      outlineWidth: 3,
      pixelOffset: new Cesium.Cartesian2(0, -14),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    }
  }

  function createShapeEntities(viewer: Cesium.Viewer, annotation: AnnotationData): Cesium.Entity[] {
    const entities: Cesium.Entity[] = []
    const style = annotation.style ?? DEFAULT_STYLE
    const color = Cesium.Color.fromCssColorString(style.color)
    const show = annotation.visible
    if (annotation.kind === 'point') {
      const [lon, lat] = annotation.points[0]
      const base: Cesium.Entity.ConstructorOptions = { position: Cesium.Cartesian3.fromDegrees(lon, lat), show, label: { ...labelOptions(), text: annotation.name, pixelOffset: new Cesium.Cartesian2(0, style.icon === 'circle' ? -16 : -30) } }
      if (style.icon === 'circle') {
        entities.push(viewer.entities.add({ ...base, point: { pixelSize: 10 * style.iconScale, color, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY } }))
      } else {
        entities.push(viewer.entities.add({ ...base, billboard: { image: iconDataUrl(style.icon, style.color), width: 32 * style.iconScale, height: 32 * style.iconScale, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY } }))
      }
    }
    if (annotation.kind === 'line') {
      const end = annotation.points[annotation.points.length - 1]
      entities.push(
        viewer.entities.add({
          show,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(annotation.points.flat()),
            width: style.lineWidth,
            clampToGround: true,
            material: color
          }
        })
      )
      entities.push(
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(end[0], end[1]),
          show,
          label: { ...labelOptions(), text: `${annotation.name} · ${kmLabel(annotation.distanceKm ?? 0)}` }
        })
      )
    }
    if (annotation.kind === 'polygon') {
      const centroid = ringCentroid(annotation.points)
      entities.push(
        viewer.entities.add({
          show,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(annotation.points.flat())),
            material: color.withAlpha(style.fillOpacity)
          }
        })
      )
      entities.push(
        viewer.entities.add({
          show,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([...annotation.points, annotation.points[0]].flat()),
            width: Math.max(1.5, style.lineWidth * 0.8),
            clampToGround: true,
            material: color
          }
        })
      )
      entities.push(
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(centroid[0], centroid[1]),
          show,
          label: { ...labelOptions(), text: `${annotation.name} · ${formatAreaKm2(annotation.areaKm2 ?? 0)}` }
        })
      )
    }
    return entities
  }

  function clearShapeEntities(viewer: Cesium.Viewer): void {
    for (const entities of shapeEntities.values()) {
      for (const entity of entities) viewer.entities.remove(entity)
    }
    shapeEntities.clear()
  }

  function syncShapeEntities(): void {
    const viewer = currentViewer()
    if (!viewer) return
    clearShapeEntities(viewer)
    for (const annotation of store.annotations) {
      shapeEntities.set(annotation.id, createShapeEntities(viewer, annotation))
    }
  }

  async function syncOverlayLayers(): Promise<void> {
    const viewer = currentViewer()
    if (!viewer) return
    const generation = ++overlayGeneration
    const active = new Set(store.overlays.map((overlay) => overlay.id))
    for (const [id, layer] of overlayLayers) {
      if (active.has(id)) continue
      viewer.imageryLayers.remove(layer, true)
      overlayLayers.delete(id)
    }
    for (const overlay of store.overlays) {
      const existing = overlayLayers.get(overlay.id)
      if (existing) {
        existing.show = overlay.visible
        existing.alpha = overlay.opacity
        continue
      }
      const url = overlayUrl(overlay)
      if (!url) continue
      try {
        const provider = await Cesium.SingleTileImageryProvider.fromUrl(url, {
          rectangle: Cesium.Rectangle.fromDegrees(overlay.west, overlay.south, overlay.east, overlay.north)
        })
        const activeViewer = currentViewer()
        if (generation !== overlayGeneration || !activeViewer) continue
        const layer = activeViewer.imageryLayers.addImageryProvider(provider)
        layer.alpha = overlay.opacity
        layer.show = overlay.visible
        overlayLayers.set(overlay.id, layer)
      } catch {
        continue
      }
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

  let pickEntity: Cesium.Entity | null = null

  function removePickEntity(): void {
    const viewer = currentViewer()
    if (pickEntity && viewer) viewer.entities.remove(pickEntity)
    pickEntity = null
  }

  function handlePick(lon: number, lat: number): void {
    const viewer = currentViewer()
    if (!viewer) return
    removePickEntity()
    const position = Cesium.Cartesian3.fromDegrees(lon, lat)
    pickEntity = viewer.entities.add({
      position,
      point: { pixelSize: 9, color: Cesium.Color.fromCssColorString('#1677ff'), outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      label: {
        text: `${formatDms(lat, false)}  ${formatDms(lon, true)}`,
        font: '13px SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        pixelOffset: new Cesium.Cartesian2(0, -16),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    })
    void Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [Cesium.Cartographic.fromDegrees(lon, lat)])
      .then(([sampled]) => {
        if (!pickEntity || !sampled || !Number.isFinite(sampled.height) || !pickEntity.label) return
        pickEntity.label.text = new Cesium.ConstantProperty(`${formatDms(lat, false)}  ${formatDms(lon, true)}\n海拔 ${Math.round(sampled.height)} m`)
      })
      .catch(() => undefined)
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
    if (store.mode === 'pick') {
      handlePick(lon, lat)
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
    void store.hydrate().then(() => {
      syncShapeEntities()
      void syncOverlayLayers()
    })
  }

  watch(viewerRef, (viewer) => {
    if (viewer && !built) build(viewer)
  })

  watch(() => store.panelOpen, (open) => {
    if (open) return
    store.setMode('none')
    store.resetDraft()
  })

  watch(() => store.mode, (mode) => {
    syncDraftPoints()
    if (mode !== 'pick') removePickEntity()
  })
  watch(() => [...store.draftPoints], syncDraftPoints)

  watch(() => store.annotations.map((annotation) => `${annotation.id}:${annotation.visible}:${annotation.name}:${JSON.stringify(annotation.style)}`).join('|'), syncShapeEntities)
  watch(() => store.overlays.map((overlay) => `${overlay.id}:${overlay.visible}:${overlay.opacity}`).join('|'), () => void syncOverlayLayers())
  watch(() => store.overlays.map((overlay) => overlay.id).join('|'), () => void syncOverlayLayers())

  onBeforeUnmount(() => {
    const viewer = currentViewer()
    handler?.destroy()
    handler = null
    window.removeEventListener('keydown', handleKeydown)
    removePickEntity()
    if (!viewer) return
    if (draftPolyline) viewer.entities.remove(draftPolyline)
    if (draftPoints) viewer.scene.primitives.remove(draftPoints)
    clearShapeEntities(viewer)
    for (const layer of overlayLayers.values()) viewer.imageryLayers.remove(layer, true)
    overlayLayers.clear()
    draftPolyline = null
    draftPoints = null
  })
}
