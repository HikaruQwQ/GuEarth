import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Cartographic, EllipsoidTerrainProvider, GeographicTilingScheme, HeightmapTerrainData, ImageryLayer, UrlTemplateImageryProvider, WebMercatorTilingScheme } from 'cesium'
import { createBasemapImageryProvider } from '../src/renderer/src/composables/basemapImagery.ts'
import { resolveFlightDestination } from '../src/renderer/src/composables/terrainFlight.ts'

function createDeepTerrainTile() {
  const scheme = new WebMercatorTilingScheme()
  const level = 30
  const position = Cartographic.fromDegrees(86.925, 27.988)
  const coordinates = scheme.positionToTileXY(position, level)
  return {
    level,
    rectangle: scheme.tileXYToRectangle(coordinates.x, coordinates.y, level),
    data: { imagery: [] }
  }
}

const deepTerrain = { getLevelMaximumGeometricError: level => 40075016.68557849 / (256 * 2 ** (level + 1)) }

test('unbounded imagery reproduces the Everest rectangle crash in Cesium', () => {
  const layer = new ImageryLayer(new UrlTemplateImageryProvider({ url: 'https://example.test/{z}/{x}/{y}.png' }))
  assert.throws(() => layer._createTileImagerySkeletons(createDeepTerrainTile(), deepTerrain), /Expected rectangle to be typeof object, actual typeof was undefined/)
  layer.destroy()
})

for (const [id, style, maximumLevel] of [['osm', 'standard', 19], ['esri-imagery', 'satellite', 23], ['opentopomap', 'topo', 17], ['baidu', 'road', 19]]) {
  test(`${id} reuses supported imagery for terrain refinement near Everest`, () => {
    const layer = new ImageryLayer(createBasemapImageryProvider(id, style))
    const tile = createDeepTerrainTile()
    assert.equal(layer._createTileImagerySkeletons(tile, deepTerrain), true)
    assert.ok(tile.data.imagery.length > 0)
    for (const imagery of tile.data.imagery) {
      assert.equal(imagery.loadingImagery.level, maximumLevel)
      assert.ok(Object.values(imagery.textureCoordinateRectangle).every(Number.isFinite))
      imagery.freeResources()
    }
    layer.destroy()
  })
}

function terrainScene(requestTileGeometry, exaggeration = 1, relativeHeight = 0) {
  return {
    terrainProvider: {
      tilingScheme: new GeographicTilingScheme(),
      availability: { computeMaximumLevelAtPosition: () => 1 },
      requestTileGeometry
    },
    verticalExaggeration: exaggeration,
    verticalExaggerationRelativeHeight: relativeHeight
  }
}

function heightmap(height) {
  return Promise.resolve(new HeightmapTerrainData({ buffer: new Float64Array(4).fill(height), width: 2, height: 2 }))
}

async function flightHeight(scene, height = 5000) {
  const destination = await resolveFlightDestination(scene, 86.925, 27.988, height)
  const position = Cartographic.fromCartesian(destination)
  assert.ok(Math.abs(position.longitude - 86.925 * Math.PI / 180) < 1e-10)
  assert.ok(Math.abs(position.latitude - 27.988 * Math.PI / 180) < 1e-10)
  return position.height
}

test('AI flight ends above the sampled Everest summit', async () => {
  assert.ok(Math.abs(await flightHeight(terrainScene(() => heightmap(8849))) - 9849) < 1e-5)
})

test('AI flight clearance follows exaggerated terrain and its reference height', async () => {
  assert.ok(Math.abs(await flightHeight(terrainScene(() => heightmap(8849), 2, 100)) - 18598) < 1e-5)
})

test('ordinary lowland flight preserves the requested height', async () => {
  assert.ok(Math.abs(await flightHeight(terrainScene(() => heightmap(50))) - 5000) < 1e-5)
})

test('high altitude flight does not wait for terrain requests', async () => {
  const scene = terrainScene(() => { assert.fail('unexpected terrain request') })
  assert.ok(Math.abs(await flightHeight(scene, 60000) - 60000) < 1e-5)
})

test('unavailable terrain uses a conservative altitude instead of entering the mountain', async () => {
  const scene = terrainScene(() => Promise.reject(new Error('offline')))
  assert.ok(Math.abs(await flightHeight(scene) - 10000) < 1e-5)
})

test('non-finite terrain samples use the conservative altitude', async () => {
  assert.ok(Math.abs(await flightHeight(terrainScene(() => heightmap(Number.NaN))) - 10000) < 1e-5)
})

test('terrain lookup timeout still allows flight', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const flight = flightHeight(terrainScene(() => new Promise(() => {})))
  context.mock.timers.tick(4000)
  assert.ok(Math.abs(await flight - 10000) < 1e-5)
})

test('ellipsoid terrain needs no network lookup', async () => {
  const scene = { terrainProvider: new EllipsoidTerrainProvider(), verticalExaggeration: 1, verticalExaggerationRelativeHeight: 0 }
  assert.ok(Math.abs(await flightHeight(scene) - 5000) < 1e-5)
})
