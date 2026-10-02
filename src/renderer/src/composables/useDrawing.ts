import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { useDrawingStore, type DrawTool, type DrawnShape, type GeoPosition } from '@renderer/stores/drawing'
import { thematicLayerCatalog } from '@renderer/stores/climate'
import { useFeatureFocusStore, type FocusedFeature } from '@renderer/stores/featureFocus'

const SHAPE_COLOR = Cesium.Color.fromCssColorString('#1677ff')
const LABEL_FONT = '13px SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace'
const LABEL_STYLE: Cesium.LabelGraphics.ConstructorOptions = {
  font: LABEL_FONT,
  fillColor: Cesium.Color.WHITE,
  outlineColor: Cesium.Color.BLACK,
  outlineWidth: 3,
  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
  pixelOffset: new Cesium.Cartesian2(0, -12),
  heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
  disableDepthTestDistance: 10_000
}

function toGeo(cartesian: Cesium.Cartesian3): GeoPosition {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
  return { longitude: Cesium.Math.toDegrees(cartographic.longitude), latitude: Cesium.Math.toDegrees(cartographic.latitude), height: cartographic.height }
}

function toCartesian(position: GeoPosition): Cesium.Cartesian3 {
  return Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.height)
}

function geodesicDistance(from: Cesium.Cartesian3, to: Cesium.Cartesian3): number {
  return new Cesium.EllipsoidGeodesic(Cesium.Cartographic.fromCartesian(from), Cesium.Cartographic.fromCartesian(to)).surfaceDistance
}

function pathDistance(cartesians: Cesium.Cartesian3[]): number {
  let total = 0
  for (let index = 1; index < cartesians.length; index += 1) total += geodesicDistance(cartesians[index - 1], cartesians[index])
  return total
}

function triangleArea(first: Cesium.Cartesian3, second: Cesium.Cartesian3, third: Cesium.Cartesian3): number {
  const ab = geodesicDistance(first, second)
  const bc = geodesicDistance(second, third)
  const ca = geodesicDistance(third, first)
  const semi = (ab + bc + ca) / 2
  const product = semi * (semi - ab) * (semi - bc) * (semi - ca)
  return product > 0 ? Math.sqrt(product) : 0
}

function polygonArea(cartesians: Cesium.Cartesian3[]): number {
  let total = 0
  for (let index = 1; index < cartesians.length - 1; index += 1) total += triangleArea(cartesians[0], cartesians[index], cartesians[index + 1])
  return total
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(1)} m`
}

function formatArea(squareMeters: number): string {
  return squareMeters >= 1000000 ? `${(squareMeters / 1000000).toFixed(2)} km²` : `${squareMeters.toFixed(0)} m²`
}

function centroidOf(cartesians: Cesium.Cartesian3[]): Cesium.Cartesian3 {
  const sum = cartesians.reduce((acc, cartesian) => Cesium.Cartesian3.add(acc, cartesian, new Cesium.Cartesian3()), new Cesium.Cartesian3())
  return Cesium.Cartesian3.multiplyByScalar(sum, 1 / cartesians.length, new Cesium.Cartesian3())
}

function dedupe(cartesians: Cesium.Cartesian3[]): Cesium.Cartesian3[] {
  return cartesians.filter((cartesian, index) => index === 0 || !Cesium.Cartesian3.equalsEpsilon(cartesian, cartesians[index - 1], 0, 0.5))
}

function surfacePosition(cartesian: Cesium.Cartesian3): Cesium.Cartesian3 {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
  return Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude)
}

function ringOf(cartesians: Cesium.Cartesian3[]): Cesium.Cartesian3[] {
  return cartesians.length ? [...cartesians, cartesians[0]] : []
}

function measurementFor(kind: DrawnShape['kind'], cartesians: Cesium.Cartesian3[]): string {
  if (kind === 'polyline' && cartesians.length >= 2) return formatDistance(pathDistance(cartesians))
  if (kind === 'polygon' && cartesians.length >= 3) return formatArea(polygonArea(cartesians))
  return ''
}

export function measureShape(shape: DrawnShape): string {
  return measurementFor(shape.kind, shape.positions.map(toCartesian))
}

export function useDrawing(viewer: Ref<Cesium.Viewer | undefined>) {
  const store = useDrawingStore()
  const focusStore = useFeatureFocusStore()
  const entities = new Map<string, Cesium.Entity>()
  let handler: Cesium.ScreenSpaceEventHandler | undefined
  let draft: Cesium.Cartesian3[] = []
  let cursor: Cesium.Cartesian3 | undefined
  let previewEntity: Cesium.Entity | undefined
  let tool: DrawTool | null = null

  function currentViewer(): Cesium.Viewer | undefined {
    const current = viewer.value
    return current && !current.isDestroyed() ? current : undefined
  }

  function isPolygonTool(next: DrawTool | null = tool): boolean {
    return next === 'polygon' || next === 'area'
  }

  function removeEntity(id: string): void {
    const current = currentViewer()
    const entity = entities.get(id)
    if (entity && current) current.entities.remove(entity)
    entities.delete(id)
  }

  function renderShape(shape: DrawnShape): void {
    const current = currentViewer()
    if (!current) return
    removeEntity(shape.id)
    const cartesians = shape.positions.map(toCartesian)
    if (!cartesians.length) return
    const options: Cesium.Entity.ConstructorOptions = { id: shape.id }
    if (shape.kind === 'point') {
      options.position = surfacePosition(cartesians[0])
      options.point = { color: SHAPE_COLOR, pixelSize: 10, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: 10_000 }
    } else if (shape.kind === 'polyline') {
      options.position = surfacePosition(centroidOf(cartesians))
      options.polyline = { positions: cartesians, width: 3, material: SHAPE_COLOR, clampToGround: true }
    } else {
      options.position = surfacePosition(centroidOf(cartesians))
      options.polygon = { hierarchy: new Cesium.PolygonHierarchy(cartesians), material: SHAPE_COLOR.withAlpha(0.25) }
      options.polyline = { positions: ringOf(cartesians), width: 2, material: SHAPE_COLOR, clampToGround: true }
    }
    const text = shape.annotation || measurementFor(shape.kind, cartesians)
    if (text) options.label = { ...LABEL_STYLE, text }
    const entity = new Cesium.Entity(options)
    current.entities.add(entity)
    entities.set(shape.id, entity)
  }

  function syncEntities(): void {
    if (!currentViewer()) return
    for (const id of [...entities.keys()]) {
      if (!store.shapes.some((shape) => shape.id === id)) removeEntity(id)
    }
    for (const shape of store.shapes) renderShape(shape)
  }

  function clearPreview(): void {
    const current = currentViewer()
    if (previewEntity && current) current.entities.remove(previewEntity)
    previewEntity = undefined
    cursor = undefined
  }

  function cancelDraft(): void {
    clearPreview()
    draft = []
  }

  function pickAt(screenPosition: Cesium.Cartesian2): Cesium.Cartesian3 | undefined {
    const current = currentViewer()
    if (!current) return undefined
    if (current.scene.pickPositionSupported) {
      const picked = current.scene.pickPosition(screenPosition)
      if (picked) return picked
    }
    return current.camera.pickEllipsoid(screenPosition) ?? undefined
  }

  function previewPositions(): Cesium.Cartesian3[] {
    return cursor ? [...draft, cursor] : [...draft]
  }

  function draftMeasurement(): string {
    const current = previewPositions()
    if (isPolygonTool()) return current.length >= 3 ? formatArea(polygonArea(current)) : ''
    return current.length >= 2 ? formatDistance(pathDistance(current)) : ''
  }

  function draftAnchor(): Cesium.Cartesian3 | undefined {
    const anchor = cursor ?? draft[draft.length - 1]
    return anchor ? surfacePosition(anchor) : undefined
  }

  function createPreview(): void {
    const current = currentViewer()
    if (!current) return
    clearPreview()
    const options: Cesium.Entity.ConstructorOptions = {
      position: new Cesium.CallbackPositionProperty(draftAnchor, false),
      label: { ...LABEL_STYLE, text: new Cesium.CallbackProperty(draftMeasurement, false) }
    }
    if (isPolygonTool()) {
      options.polygon = { hierarchy: new Cesium.CallbackProperty(() => new Cesium.PolygonHierarchy(previewPositions()), false), material: SHAPE_COLOR.withAlpha(0.15) }
      options.polyline = { positions: new Cesium.CallbackProperty(() => ringOf(previewPositions()), false), width: 2, material: SHAPE_COLOR.withAlpha(0.6), clampToGround: true }
    } else {
      options.polyline = { positions: new Cesium.CallbackProperty(previewPositions, false), width: 2, material: SHAPE_COLOR.withAlpha(0.6), clampToGround: true }
    }
    previewEntity = new Cesium.Entity(options)
    current.entities.add(previewEntity)
  }

  function commit(cartesians: Cesium.Cartesian3[]): void {
    const kind = tool === 'point' ? 'point' : isPolygonTool() ? 'polygon' : 'polyline'
    const positions = dedupe(cartesians)
    cancelDraft()
    const id = crypto.randomUUID()
    store.addShape({ id, kind, positions: positions.map(toGeo), annotation: '', createdAt: Date.now() })
    if (kind === 'point' || tool === 'line' || tool === 'polygon') store.setSelectedShapeId(id)
    tool = null
    store.setActiveTool(null)
  }

  function thematicFeatureOf(entity: Cesium.Entity): FocusedFeature | null {
    if (!(entity.properties instanceof Cesium.PropertyBag)) return null
    const values = entity.properties.getValue(Cesium.JulianDate.now()) as Record<string, unknown>
    const name = typeof values.name === 'string' ? values.name : ''
    const layerId = typeof values.layerId === 'string' ? values.layerId : ''
    const summary = typeof values.summary === 'string' ? values.summary : ''
    if (!name || !layerId || !summary) return null
    const layerName = thematicLayerCatalog.find((layer) => layer.id === layerId)?.name ?? layerId
    return { name, layerName, summary }
  }

  function handleClick(movement: { position: Cesium.Cartesian2 }): void {
    if (!tool) {
      const current = currentViewer()
      if (!current) return
      const picked = current.scene.pick(movement.position)
      if (picked && picked.id instanceof Cesium.Entity) {
        const entity = picked.id
        if (entities.has(entity.id)) {
          store.setSelectedShapeId(entity.id)
          focusStore.clearFocus()
          return
        }
        const feature = thematicFeatureOf(entity)
        if (feature) {
          focusStore.setFocus(feature)
          store.setSelectedShapeId(null)
          return
        }
      }
      store.setSelectedShapeId(null)
      focusStore.clearFocus()
      return
    }
    if (tool === 'timezone') return
    const position = pickAt(movement.position)
    if (!position) return
    if (tool === 'point') {
      commit([position])
      return
    }
    draft.push(position)
    if (draft.length === 1) createPreview()
  }

  function handleDoubleClick(): void {
    if (!tool || tool === 'point') return
    const positions = dedupe([...draft])
    const minimum = isPolygonTool() ? 3 : 2
    if (positions.length < minimum) return
    commit(positions)
  }

  function handleMove(movement: { endPosition: Cesium.Cartesian2 }): void {
    if (!tool || tool === 'point' || !draft.length) return
    cursor = pickAt(movement.endPosition)
  }

  function handleRightClick(): void {
    if (!tool || tool === 'point' || dedupe(draft).length < (isPolygonTool() ? 3 : 2)) {
      cancelDraft()
      return
    }
    commit(draft)
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return
    cancelDraft()
    if (tool) {
      tool = null
      store.setActiveTool(null)
    }
    store.setSelectedShapeId(null)
  }

  function flyToShape(shape: DrawnShape): void {
    const current = currentViewer()
    if (!current) return
    const cartesians = shape.positions.map(toCartesian)
    if (!cartesians.length) return
    if (shape.kind === 'point') {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesians[0])
      current.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude), 8000), duration: 1.2 })
      return
    }
    const sphere = Cesium.BoundingSphere.fromPoints(cartesians)
    current.camera.flyToBoundingSphere(sphere, { offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), Math.max(sphere.radius * 3, 1000)), duration: 1.2 })
  }

  watch(
    viewer,
    (current) => {
      if (!current || current.isDestroyed()) return
      current.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
      handler = new Cesium.ScreenSpaceEventHandler(current.scene.canvas)
      handler.setInputAction(handleClick, Cesium.ScreenSpaceEventType.LEFT_CLICK)
      handler.setInputAction(handleMove, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
      handler.setInputAction(handleDoubleClick, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
      handler.setInputAction(handleRightClick, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
      void store.load()
      syncEntities()
    },
    { flush: 'post' }
  )

  watch(() => store.activeTool, (next) => {
    cancelDraft()
    tool = next
  })

  watch(() => store.shapes, syncEntities, { deep: true })

  onMounted(() => window.addEventListener('keydown', handleKeydown))

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
    handler?.destroy()
    handler = undefined
  })

  return { flyToShape }
}
