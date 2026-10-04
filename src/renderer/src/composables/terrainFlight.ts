import { Cartesian3, Cartographic, EllipsoidTerrainProvider, sampleTerrainMostDetailed, type Scene } from 'cesium'

const FLIGHT_TERRAIN_TIMEOUT_MS = 4000
const FLIGHT_TERRAIN_FALLBACK_HEIGHT = 9000
const FLIGHT_TERRAIN_CLEARANCE = 1000

export async function resolveFlightDestination(scene: Scene, longitude: number, latitude: number, height: number): Promise<Cartesian3> {
  const terrain = scene.terrainProvider
  const exaggeration = scene.verticalExaggeration
  const relativeHeight = scene.verticalExaggerationRelativeHeight
  const surfaceHeight = (value: number): number => (value - relativeHeight) * exaggeration + relativeHeight
  const safeHeight = (ground: number): number => Math.max(height, surfaceHeight(ground) + FLIGHT_TERRAIN_CLEARANCE)
  if (terrain instanceof EllipsoidTerrainProvider) return Cartesian3.fromDegrees(longitude, latitude, safeHeight(0))
  const fallbackHeight = safeHeight(FLIGHT_TERRAIN_FALLBACK_HEIGHT)
  if (height >= fallbackHeight) return Cartesian3.fromDegrees(longitude, latitude, height)
  const position = Cartographic.fromDegrees(longitude, latitude)
  position.height = Number.NaN
  let clearTerrainTimeout: (() => void) | undefined
  try {
    const sampled = await Promise.race([
      sampleTerrainMostDetailed(terrain, [position], true),
      new Promise<undefined>((resolve) => {
        const timer = setTimeout(() => resolve(undefined), FLIGHT_TERRAIN_TIMEOUT_MS)
        clearTerrainTimeout = () => clearTimeout(timer)
      })
    ])
    const ground = sampled?.[0]?.height
    return Cartesian3.fromDegrees(longitude, latitude, ground !== undefined && Number.isFinite(ground) ? safeHeight(ground) : fallbackHeight)
  } catch {
    return Cartesian3.fromDegrees(longitude, latitude, fallbackHeight)
  } finally {
    clearTerrainTimeout?.()
  }
}
