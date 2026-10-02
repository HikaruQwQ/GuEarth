import { onBeforeUnmount, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { useTerrainLabStore } from '@renderer/stores/terrainLab'
import {
  clampSelectionBounds,
  densifyLine,
  extractContours,
  legLengthKm,
  niceContourInterval,
  rectAreaKm2,
  rectSizeKm,
  terrainLevelForSpan,
  HYPSOMETRIC_STOPS,
  type ElevationGrid,
  type GridBounds
} from '@renderer/utils/geo'
import type { ProfileSample } from '@renderer/utils/geo'

const ELEVATION_URL = 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer'
const GRID_COLS = 80
const SKIRT_DEPTH = 600
const SELECTION_COLOR = '#1677ff'
const PROFILE_COLOR = '#fa541c'

let elevationProviderPromise: Promise<Cesium.ArcGISTiledElevationTerrainProvider> | null = null

function elevationProvider(): Promise<Cesium.ArcGISTiledElevationTerrainProvider> {
  elevationProviderPromise ??= Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(ELEVATION_URL)
  return elevationProviderPromise
}

function mixHex(a: string, b: string, t: number): string {
  const parse = (value: string): [number, number, number] => [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16)
  ]
  const [r0, g0, b0] = parse(a)
  const [r1, g1, b1] = parse(b)
  const to = (x0: number, x1: number): number => Math.round(x0 + (x1 - x0) * t)
  return `rgb(${to(r0, r1)}, ${to(g0, g1)}, ${to(b0, b1)})`
}

function rampColor(stops: Array<[number, string]>, t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  for (let i = 1; i < stops.length; i++) {
    const [t0, c0] = stops[i - 1]
    const [t1, c1] = stops[i]
    if (clamped <= t1) return mixHex(c0, c1, (clamped - t0) / (t1 - t0 || 1))
  }
  return stops[stops.length - 1][1]
}

const SLOPE_STOPS: Array<[number, string]> = [
  [0, '#52c41a'],
  [0.22, '#a0d911'],
  [0.45, '#fadb14'],
  [0.7, '#fa8c16'],
  [0.87, '#f5222d'],
  [1, '#a8071a']
]

function gradientTextureUrl(stops: Array<[number, string]>): string {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return ''
  for (let y = 0; y < 256; y++) {
    context.fillStyle = rampColor(stops, y / 255)
    context.fillRect(0, y, 4, 1)
  }
  return canvas.toDataURL()
}

function hypsometricTextureUrl(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return ''
  for (let y = 0; y < 256; y++) {
    context.fillStyle = rampColor(HYPSOMETRIC_STOPS, 1 - y / 255)
    context.fillRect(0, y, 4, 1)
  }
  return canvas.toDataURL()
}

function slopeTextureUrl(): string {
  return gradientTextureUrl(SLOPE_STOPS)
}

function gridDimensions(bounds: GridBounds): { cols: number; rows: number } {
  const midLat = ((bounds.north + bounds.south) / 2) * (Math.PI / 180)
  const widthKm = Math.abs((bounds.east - bounds.west) * 111.32 * Math.cos(midLat))
  const heightKm = Math.abs((bounds.north - bounds.south) * 110.57)
  const rows = Math.round((GRID_COLS * heightKm) / Math.max(widthKm, 0.001))
  return { cols: GRID_COLS, rows: Math.min(96, Math.max(12, rows)) }
}

interface MeshGeometryData {
  positions: Float64Array
  normals: Float32Array
  sts: Float32Array
  indices: Uint16Array
  boundingSphere: Cesium.BoundingSphere
}

function buildMeshGeometry(grid: ElevationGrid, exaggeration: number, baseAltitude: number, slopeMode: boolean): MeshGeometryData {
  const { cols, rows, bounds, min, max, values } = grid
  const valueRange = max - min || 1
  const gridVertexCount = cols * rows
  const surfaceHeight = (value: number): number => baseAltitude + value * exaggeration
  const centerLatRad = (((bounds.north + bounds.south) / 2) * Math.PI) / 180
  const lonSpacingM = (111320 * Math.cos(centerLatRad) * (bounds.east - bounds.west)) / (cols - 1)
  const latSpacingM = (110574 * (bounds.north - bounds.south)) / (rows - 1)
  const slopeAt = (row: number, col: number): number => {
    const r0 = Math.max(0, row - 1)
    const r1 = Math.min(rows - 1, row + 1)
    const c0 = Math.max(0, col - 1)
    const c1 = Math.min(cols - 1, col + 1)
    const dzdx = (values[row * cols + c1] - values[row * cols + c0]) / Math.max(1, (c1 - c0) * lonSpacingM)
    const dzdy = (values[r0 * cols + col] - values[r1 * cols + col]) / Math.max(1, (r0 - r1) * latSpacingM)
    return Math.min(1, Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) / (Math.PI / 4))
  }
  const positions: Cesium.Cartesian3[] = new Array(gridVertexCount)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lon = bounds.west + ((bounds.east - bounds.west) * col) / (cols - 1)
      const lat = bounds.north - ((bounds.north - bounds.south) * row) / (rows - 1)
      positions[row * cols + col] = Cesium.Cartesian3.fromDegrees(lon, lat, surfaceHeight(values[row * cols + col]))
    }
  }
  const borderRing: number[] = []
  for (let col = 0; col < cols; col++) borderRing.push(col)
  for (let row = 1; row < rows; row++) borderRing.push(row * cols + cols - 1)
  for (let col = cols - 2; col >= 0; col--) borderRing.push((rows - 1) * cols + col)
  for (let row = rows - 2; row >= 1; row--) borderRing.push(row * cols)
  const skirtBase = gridVertexCount
  const total = skirtBase + borderRing.length
  const positionArray = new Float64Array(total * 3)
  const normalArray = new Float32Array(total * 3)
  const stArray = new Float32Array(total * 2)
  positions.forEach((position, index) => {
    positionArray[index * 3] = position.x
    positionArray[index * 3 + 1] = position.y
    positionArray[index * 3 + 2] = position.z
  })
  const normalFor = (row: number, col: number): Cesium.Cartesian3 => {
    const r0 = Math.max(0, row - 1)
    const r1 = Math.min(rows - 1, row + 1)
    const c0 = Math.max(0, col - 1)
    const c1 = Math.min(cols - 1, col + 1)
    const east = Cesium.Cartesian3.subtract(positions[row * cols + c1], positions[row * cols + c0], new Cesium.Cartesian3())
    const north = Cesium.Cartesian3.subtract(positions[r0 * cols + col], positions[r1 * cols + col], new Cesium.Cartesian3())
    const normal = Cesium.Cartesian3.cross(east, north, new Cesium.Cartesian3())
    return Cesium.Cartesian3.normalize(normal, normal)
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col
      const normal = normalFor(row, col)
      normalArray[index * 3] = normal.x
      normalArray[index * 3 + 1] = normal.y
      normalArray[index * 3 + 2] = normal.z
      stArray[index * 2] = col / (cols - 1)
      stArray[index * 2 + 1] = slopeMode ? slopeAt(row, col) : (values[index] - min) / valueRange
    }
  }
  borderRing.forEach((surfaceIndex, ringIndex) => {
    const index = skirtBase + ringIndex
    positionArray[index * 3] = positionArray[surfaceIndex * 3]
    positionArray[index * 3 + 1] = positionArray[surfaceIndex * 3 + 1]
    positionArray[index * 3 + 2] = positionArray[surfaceIndex * 3 + 2] - SKIRT_DEPTH
    const normal = new Cesium.Cartesian3(normalArray[surfaceIndex * 3], normalArray[surfaceIndex * 3 + 1], normalArray[surfaceIndex * 3 + 2])
    normalArray[index * 3] = normal.x
    normalArray[index * 3 + 1] = normal.y
    normalArray[index * 3 + 2] = normal.z
    stArray[index * 2] = stArray[surfaceIndex * 2]
    stArray[index * 2 + 1] = 0
  })
  const indices: number[] = []
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const a = row * cols + col
      const b = a + 1
      const c = (row + 1) * cols + col
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  for (let ringIndex = 0; ringIndex < borderRing.length; ringIndex++) {
    const next = (ringIndex + 1) % borderRing.length
    const a = borderRing[ringIndex]
    const b = borderRing[next]
    const sa = skirtBase + ringIndex
    const sb = skirtBase + next
    indices.push(a, sa, sb, a, sb, b)
  }
  const cartesianList = []
  for (let index = 0; index < total; index++) {
    cartesianList.push(new Cesium.Cartesian3(positionArray[index * 3], positionArray[index * 3 + 1], positionArray[index * 3 + 2]))
  }
  return {
    positions: positionArray,
    normals: normalArray,
    sts: stArray,
    indices: new Uint16Array(indices),
    boundingSphere: Cesium.BoundingSphere.fromPoints(cartesianList)
  }
}

export function useRegionTerrain(viewerRef: Ref<Cesium.Viewer | undefined>) {
  const store = useTerrainLabStore()
  let handler: Cesium.ScreenSpaceEventHandler | null = null
  let selectionEntity: Cesium.Entity | null = null
  let provisionalEntity: Cesium.Entity | null = null
  let profileWall: Cesium.Entity | null = null
  let meshPrimitive: Cesium.Primitive | null = null
  let peakMarker: Cesium.Entity | null = null
  let contourCollection: Cesium.PolylineCollection | null = null
  let profileCollection: Cesium.PolylineCollection | null = null
  let grid: ElevationGrid | null = null
  let level = 10
  let baseAltitude = 0
  let dragStart: [number, number] | null = null
  let dragEnd: [number, number] | null = null
  let dragging = false
  let generation = 0
  let provisionalFlat: number[] = []
  let lastProfileLine: Array<[number, number]> | null = null
  let lastProfileHeights: number[] | null = null

  function currentViewer(): Cesium.Viewer | null {
    const viewer = viewerRef.value
    return viewer && !viewer.isDestroyed() ? viewer : null
  }

  function pickDegrees(viewer: Cesium.Viewer, position: Cesium.Cartesian2): [number, number] | null {
    const cartesian = viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid)
    if (!cartesian) return null
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
    return [Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)]
  }

  function rectangleBetween(start: [number, number], end: [number, number]): Cesium.Rectangle {
    return Cesium.Rectangle.fromDegrees(
      Math.min(start[0], end[0]),
      Math.min(start[1], end[1]),
      Math.max(start[0], end[0]),
      Math.max(start[1], end[1])
    )
  }

  function ensureSelectionEntity(viewer: Cesium.Viewer): void {
    if (selectionEntity) return
    selectionEntity = viewer.entities.add({
      rectangle: {
        coordinates: new Cesium.CallbackProperty(() => {
          if (!dragStart || !dragEnd) return Cesium.Rectangle.fromDegrees(0, 0, 0.01, 0.01)
          return rectangleBetween(dragStart, dragEnd)
        }, false),
        material: Cesium.Color.fromCssColorString(SELECTION_COLOR).withAlpha(0.14),
        outlineColor: Cesium.Color.fromCssColorString(SELECTION_COLOR).withAlpha(0.85)
      }
    })
  }

  function removeSelectionActions(): void {
    if (!handler) return
    handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOWN)
    handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP)
  }

  function startSelection(): void {
    const viewer = currentViewer()
    if (!viewer) return
    cancelSelection()
    store.beginSelection()
    handler ??= new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      dragStart = pickDegrees(viewer, movement.position)
      if (dragStart) {
        dragEnd = dragStart
        dragging = true
        viewer.scene.screenSpaceCameraController.enableInputs = false
        ensureSelectionEntity(viewer)
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN)
    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (dragging) dragEnd = pickDegrees(viewer, movement.endPosition) ?? dragEnd
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    handler.setInputAction(() => {
      if (!dragging || !dragStart || !dragEnd) return
      dragging = false
      viewer.scene.screenSpaceCameraController.enableInputs = true
      removeSelectionActions()
      finalizeSelection()
    }, Cesium.ScreenSpaceEventType.LEFT_UP)
  }

  function finalizeSelection(): void {
    const bounds = clampSelectionBounds({
      west: Math.min(dragStart![0], dragEnd![0]),
      east: Math.max(dragStart![0], dragEnd![0]),
      south: Math.min(dragStart![1], dragEnd![1]),
      north: Math.max(dragStart![1], dragEnd![1])
    })
    dragStart = null
    dragEnd = null
    const viewer = currentViewer()
    if (!viewer) return
    void sampleAndBuild(viewer, bounds)
  }

  function cancelSelection(): void {
    removeSelectionActions()
    dragging = false
    dragStart = null
    dragEnd = null
    const viewer = currentViewer()
    if (viewer) viewer.scene.screenSpaceCameraController.enableInputs = true
    if (store.phase === 'selecting') store.phase = grid ? 'ready' : 'idle'
  }

  async function sampleAndBuild(viewer: Cesium.Viewer, bounds: GridBounds): Promise<void> {
    const expected = ++generation
    store.setBounds(bounds)
    store.setError('')
    try {
      const provider = await elevationProvider()
      const { cols, rows } = gridDimensions(bounds)
      const cartographics: Cesium.Cartographic[] = []
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          cartographics.push(
            Cesium.Cartographic.fromDegrees(
              bounds.west + ((bounds.east - bounds.west) * col) / (cols - 1),
              bounds.north - ((bounds.north - bounds.south) * row) / (rows - 1)
            )
          )
        }
      }
      level = terrainLevelForSpan(Math.max(bounds.east - bounds.west, bounds.north - bounds.south))
      await Cesium.sampleTerrain(provider, level, cartographics)
      if (expected !== generation) return
      const values = cartographics.map((cartographic) => cartographic.height ?? 0)
      grid = {
        cols,
        rows,
        bounds,
        min: Math.min(...values),
        max: Math.max(...values),
        values
      }
      store.setStats({
        minElevation: grid.min,
        maxElevation: grid.max,
        areaKm2: rectAreaKm2(bounds),
        ...rectSizeKm(bounds)
      })
      lastProfileLine = null
      lastProfileHeights = null
      provisionalFlat = []
      rebuildMesh(expected)
      rebuildContours()
      removeProfileVisuals()
      store.profilePoints = []
      store.profile = null
      store.setReady()
      frameRegion(viewer, bounds)
    } catch (cause) {
      if (expected !== generation) return
      store.setError(cause instanceof Error ? cause.message : '高程采样失败，请重试')
    }
  }

  function frameRegion(viewer: Cesium.Viewer, bounds: GridBounds): void {
    const rectangle = Cesium.Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north)
    const fit = viewer.camera.getRectangleCameraCoordinates(rectangle)
    if (!fit) {
      viewer.camera.flyTo({ destination: rectangle, duration: 1.2 })
      return
    }
    const cartographic = Cesium.Cartographic.fromCartesian(fit)
    const height = Math.max(cartographic.height, baseAltitude * 3.5)
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, height),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-35), roll: 0 },
      duration: 1.2
    })
  }

  function rebuildMesh(expected: number): void {
    const viewer = currentViewer()
    if (!viewer || !grid) return
    if (meshPrimitive) {
      viewer.scene.primitives.remove(meshPrimitive)
      meshPrimitive = null
    }
    removePeakMarker()
    baseAltitude = grid.max * store.exaggeration + 1500
    const data = buildMeshGeometry(grid, store.exaggeration, baseAltitude, store.slopeAnalysis)
    if (expected !== generation) return
    const geometry = new Cesium.Geometry({
      attributes: {
        position: new Cesium.GeometryAttribute({ componentDatatype: Cesium.ComponentDatatype.DOUBLE, componentsPerAttribute: 3, values: data.positions }),
        normal: new Cesium.GeometryAttribute({ componentDatatype: Cesium.ComponentDatatype.FLOAT, componentsPerAttribute: 3, values: data.normals }),
        st: new Cesium.GeometryAttribute({ componentDatatype: Cesium.ComponentDatatype.FLOAT, componentsPerAttribute: 2, values: data.sts })
      } as Cesium.GeometryAttributes,
      indices: data.indices,
      primitiveType: Cesium.PrimitiveType.TRIANGLES,
      boundingSphere: data.boundingSphere
    })
    const material = Cesium.Material.fromType('Image', { image: store.slopeAnalysis ? slopeTextureUrl() : hypsometricTextureUrl() })
    const appearance = new Cesium.MaterialAppearance({
      material,
      flat: false,
      translucent: false,
      renderState: { cull: { enabled: false } }
    })
    meshPrimitive = viewer.scene.primitives.add(
      new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({ geometry }),
        appearance,
        asynchronous: false
      })
    )
    if (store.slopeAnalysis) addPeakMarker()
  }

  function removePeakMarker(): void {
    const viewer = currentViewer()
    if (peakMarker && viewer) viewer.entities.remove(peakMarker)
    peakMarker = null
  }

  function addPeakMarker(): void {
    const viewer = currentViewer()
    if (!viewer || !grid) return
    const { cols, rows, bounds, values } = grid
    let bestIndex = 0
    for (let index = 1; index < values.length; index++) {
      if (values[index] > values[bestIndex]) bestIndex = index
    }
    const col = bestIndex % cols
    const row = Math.floor(bestIndex / cols)
    const lon = bounds.west + ((bounds.east - bounds.west) * col) / (cols - 1)
    const lat = bounds.north - ((bounds.north - bounds.south) * row) / (rows - 1)
    peakMarker = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, baseAltitude + values[bestIndex] * store.exaggeration + 40),
      point: { pixelSize: 10, color: Cesium.Color.fromCssColorString('#f5222d'), outlineColor: Cesium.Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      label: {
        text: `山峰 ${Math.round(values[bestIndex])} m`,
        font: '12px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#f5222d'),
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
        outlineWidth: 3,
        pixelOffset: new Cesium.Cartesian2(0, -14),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    })
  }

  function rebuildContours(): void {
    const viewer = currentViewer()
    if (!viewer || !grid) return
    if (contourCollection) {
      viewer.scene.primitives.remove(contourCollection)
      contourCollection = null
    }
    const interval = store.contourInterval > 0 ? store.contourInterval : niceContourInterval(grid.max - grid.min)
    const lines = extractContours(grid, interval)
    const collection = new Cesium.PolylineCollection()
    for (const line of lines) {
      const positions: Cesium.Cartesian3[] = []
      for (let i = 0; i < line.points.length; i += 2) {
        positions.push(
          Cesium.Cartesian3.fromDegrees(
            line.points[i],
            line.points[i + 1],
            baseAltitude + line.elevation * store.exaggeration + 4
          )
        )
      }
      const isIndex = Math.round(line.elevation / interval) % 5 === 0
      collection.add({
        positions,
        width: isIndex ? 2.4 : 1.2,
        material: Cesium.Material.fromType('Color', {
          color: isIndex
            ? Cesium.Color.fromCssColorString('#4a2f16').withAlpha(0.9)
            : Cesium.Color.fromCssColorString('#7a5230').withAlpha(0.55)
        })
      })
    }
    contourCollection = viewer.scene.primitives.add(collection)
  }

  function removeProfileVisuals(): void {
    const viewer = currentViewer()
    if (!viewer) return
    if (profileCollection) {
      viewer.scene.primitives.remove(profileCollection)
      profileCollection = null
    }
    if (profileWall) {
      viewer.entities.remove(profileWall)
      profileWall = null
    }
    if (provisionalEntity) {
      viewer.entities.remove(provisionalEntity)
      provisionalEntity = null
    }
  }

  function drawProfileVisual(line: Array<[number, number]>, heights: number[]): void {
    const viewer = currentViewer()
    if (!viewer || !grid) return
    if (profileCollection) {
      viewer.scene.primitives.remove(profileCollection)
      profileCollection = null
    }
    if (profileWall) {
      viewer.entities.remove(profileWall)
      profileWall = null
    }
    if (provisionalEntity) {
      viewer.entities.remove(provisionalEntity)
      provisionalEntity = null
    }
    profileCollection = new Cesium.PolylineCollection()
    const surfacePositions = line.map((point, index) =>
      Cesium.Cartesian3.fromDegrees(point[0], point[1], baseAltitude + heights[index] * store.exaggeration + 8)
    )
    profileCollection.add({
      positions: surfacePositions,
      width: 4,
      material: Cesium.Material.fromType('Color', { color: Cesium.Color.fromCssColorString(PROFILE_COLOR).withAlpha(0.95) })
    })
    const wallPositions: number[] = []
    line.forEach((point, index) => {
      wallPositions.push(point[0], point[1], baseAltitude + heights[index] * store.exaggeration + 8)
    })
    profileWall = viewer.entities.add({
      wall: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(wallPositions),
        minimumHeights: line.map(() => baseAltitude - SKIRT_DEPTH),
        material: Cesium.Color.fromCssColorString(PROFILE_COLOR).withAlpha(0.25),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(PROFILE_COLOR).withAlpha(0.6)
      }
    })
    viewer.scene.primitives.add(profileCollection)
  }

  async function resample(): Promise<void> {
    const viewer = currentViewer()
    const bounds = store.bounds
    if (!viewer || !bounds) return
    await sampleAndBuild(viewer, bounds)
  }

  function getContours(): import('@renderer/utils/geo').ContourLine[] {
    if (!grid) return []
    const interval = store.contourInterval > 0 ? store.contourInterval : niceContourInterval(grid.max - grid.min)
    return extractContours(grid, interval)
  }

  function removeModel(): void {
    generation++
    const viewer = currentViewer()
    if (viewer) {
      if (meshPrimitive) viewer.scene.primitives.remove(meshPrimitive)
      if (contourCollection) viewer.scene.primitives.remove(contourCollection)
      if (profileCollection) viewer.scene.primitives.remove(profileCollection)
      if (profileWall) viewer.entities.remove(profileWall)
      if (provisionalEntity) viewer.entities.remove(provisionalEntity)
      if (selectionEntity) viewer.entities.remove(selectionEntity)
      if (peakMarker) viewer.entities.remove(peakMarker)
    }
    meshPrimitive = null
    contourCollection = null
    profileCollection = null
    profileWall = null
    provisionalEntity = null
    selectionEntity = null
    peakMarker = null
    grid = null
    lastProfileLine = null
    lastProfileHeights = null
  }

  function startProfile(): void {
    if (!grid) return
    removeProfileVisuals()
    lastProfileLine = null
    lastProfileHeights = null
    const viewer = currentViewer()
    if (!viewer) return
    handler ??= new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (store.phase !== 'drawingProfile' || !store.bounds) return
      const picked = pickDegrees(viewer, movement.position)
      if (!picked) return
      const bounds = store.bounds
      const lon = Math.min(bounds.east, Math.max(bounds.west, picked[0]))
      const lat = Math.min(bounds.north, Math.max(bounds.south, picked[1]))
      store.addProfilePoint([lon, lat])
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
    handler.setInputAction(() => {
      if (store.phase === 'drawingProfile' && store.profilePoints.length >= 2) void finishProfile()
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
  }

  function finishProfile(): void {
    const points = store.profilePoints
    if (points.length < 2 || !grid) return
    removeSelectionClickActions()
    void (async () => {
      const expected = generation
      const dense = densifyLine(points, 160)
      const provider = await elevationProvider()
      const cartographics = dense.map((point) => Cesium.Cartographic.fromDegrees(point[0], point[1]))
      await Cesium.sampleTerrain(provider, level, cartographics)
      if (expected !== generation) return
      const heights = cartographics.map((cartographic) => cartographic.height ?? 0)
      const samples: ProfileSample[] = []
      let distance = 0
      dense.forEach((point, index) => {
        if (index > 0) distance += legLengthKm(dense[index - 1], point)
        samples.push({ distanceKm: distance, longitude: point[0], latitude: point[1], elevation: heights[index] })
      })
      lastProfileLine = dense
      lastProfileHeights = heights
      store.setProfile(samples)
      drawProfileVisual(dense, heights)
    })()
  }

  function removeSelectionClickActions(): void {
    if (!handler) return
    handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
    handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK)
  }

  function clearProfile(): void {
    removeProfileVisuals()
    lastProfileLine = null
    lastProfileHeights = null
  }

  watch(() => store.profilePoints.length, () => {
    const viewer = currentViewer()
    if (!viewer) return
    const points = store.profilePoints
    if (store.phase !== 'drawingProfile' || points.length === 0) return
    provisionalFlat = []
    points.forEach((point) => provisionalFlat.push(point[0], point[1]))
    if (!provisionalEntity) {
      provisionalEntity = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => Cesium.Cartesian3.fromDegreesArray(provisionalFlat), false),
          width: 3,
          clampToGround: true,
          material: Cesium.Color.fromCssColorString(PROFILE_COLOR).withAlpha(0.9)
        }
      })
    }
  })

  watch(() => store.exaggeration, () => {
    if (!grid) return
    const expected = ++generation
    rebuildMesh(expected)
    rebuildContours()
    if (lastProfileLine && lastProfileHeights) drawProfileVisual(lastProfileLine, lastProfileHeights)
  })

  watch(() => store.contourInterval, () => {
    if (!grid) return
    rebuildContours()
  })

  watch(() => store.slopeAnalysis, () => {
    if (!grid) return
    const expected = ++generation
    rebuildMesh(expected)
  })

  onBeforeUnmount(() => {
    generation++
    const viewer = currentViewer()
    if (viewer) viewer.scene.screenSpaceCameraController.enableInputs = true
    handler?.destroy()
    handler = null
    removeModel()
    store.panelOpen = false
  })

  return {
    startSelection,
    cancelSelection,
    startProfile,
    finishProfile,
    clearProfile,
    removeModel,
    resample,
    getContours
  }
}
