import { onBeforeUnmount, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { useMonsoonStore } from '@renderer/stores/monsoon'
import { monsoonWindAt, rainBandForMonth, rainBandRing } from '@renderer/utils/geo'
import { CLIMATE_REGIONS } from '@renderer/utils/climateData'
import type { CurrentDefinition } from '@renderer/utils/monsoonData'
import {
  CHINA_CLIMATE_ZONES,
  INDIAN_SUMMER_CURRENTS,
  INDIAN_WINTER_CURRENTS,
  MONSOON_BOX,
  OCEAN_CURRENTS,
  SUMMER_MONSOON_ARROWS,
  WINTER_MONSOON_ARROWS
} from '@renderer/utils/monsoonData'

const PARTICLE_COUNT = 600
const PARTICLE_ALTITUDE = 9000
const CURRENT_ALTITUDE = 1500
const ARROW_ALTITUDE = 4000
const PARTICLE_SPEED = 3.2

interface Particle {
  lon: number
  lat: number
  age: number
  life: number
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function useMonsoonLayer(viewerRef: Ref<Cesium.Viewer | undefined>) {
  const store = useMonsoonStore()
  let particleCollection: Cesium.PolylineCollection | null = null
  let currentCollection: Cesium.PolylineCollection | null = null
  let indianSummerCollection: Cesium.PolylineCollection | null = null
  let indianWinterCollection: Cesium.PolylineCollection | null = null
  let summerCollection: Cesium.PolylineCollection | null = null
  let winterCollection: Cesium.PolylineCollection | null = null
  let currentLabels: Cesium.LabelCollection | null = null
  let indianSummerLabels: Cesium.LabelCollection | null = null
  let indianWinterLabels: Cesium.LabelCollection | null = null
  let climateLabels: Cesium.LabelCollection | null = null
  let rainbandEntity: Cesium.Entity | null = null
  let rainbandLabel: Cesium.Entity | null = null
  const climateEntities: Cesium.Entity[] = []
  const climateRegionEntities: Cesium.Entity[] = []
  let climateRegionLabels: Cesium.LabelCollection | null = null
  const particles: Particle[] = []
  const particlePolylines: Cesium.Polyline[] = []
  let lastFrame = 0
  let removePreUpdate: (() => void) | null = null
  let built = false

  function currentViewer(): Cesium.Viewer | null {
    const viewer = viewerRef.value
    return viewer && !viewer.isDestroyed() ? viewer : null
  }

  function respawn(particle: Particle): void {
    particle.lon = randomInRange(MONSOON_BOX.west, MONSOON_BOX.east)
    particle.lat = randomInRange(MONSOON_BOX.south, MONSOON_BOX.north)
    particle.age = 0
    particle.life = randomInRange(3, 9)
  }

  function buildParticles(viewer: Cesium.Viewer): void {
    const collection = new Cesium.PolylineCollection()
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const particle: Particle = { lon: 0, lat: 0, age: 0, life: 0 }
      respawn(particle)
      particle.age = Math.random() * particle.life
      particles.push(particle)
      const polyline = collection.add({
        positions: [Cesium.Cartesian3.fromDegrees(particle.lon, particle.lat, PARTICLE_ALTITUDE), Cesium.Cartesian3.fromDegrees(particle.lon, particle.lat, PARTICLE_ALTITUDE)],
        width: 2,
        material: Cesium.Material.fromType('Color', { color: Cesium.Color.WHITE.withAlpha(0.8) })
      })
      particlePolylines.push(polyline)
    }
    particleCollection = viewer.scene.primitives.add(collection)
  }

  function addCurrents(collection: Cesium.PolylineCollection, labels: Cesium.LabelCollection, defs: CurrentDefinition[]): void {
    for (const current of defs) {
      const positions = current.path.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, CURRENT_ALTITUDE))
      collection.add({
        positions,
        width: 3,
        material: Cesium.Material.fromType('Color', {
          color: Cesium.Color.fromCssColorString(current.warm ? '#f5222d' : '#2f54eb').withAlpha(0.85)
        })
      })
      labels.add({
        position: Cesium.Cartesian3.fromDegrees(current.labelAt[0], current.labelAt[1], CURRENT_ALTITUDE + 800),
        text: current.name,
        font: '12px sans-serif',
        fillColor: Cesium.Color.fromCssColorString(current.warm ? '#f5222d' : '#2f54eb'),
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
        outlineWidth: 3,
        pixelOffset: new Cesium.Cartesian2(0, -8),
        scale: 0.9
      })
    }
  }

  function buildCurrents(viewer: Cesium.Viewer): void {
    const collection = new Cesium.PolylineCollection()
    const labels = new Cesium.LabelCollection()
    addCurrents(collection, labels, OCEAN_CURRENTS)
    currentCollection = viewer.scene.primitives.add(collection)
    currentLabels = viewer.scene.primitives.add(labels)
  }

  function buildIndianCurrents(viewer: Cesium.Viewer): void {
    const summer = new Cesium.PolylineCollection()
    const summerLabels = new Cesium.LabelCollection()
    addCurrents(summer, summerLabels, INDIAN_SUMMER_CURRENTS)
    indianSummerCollection = viewer.scene.primitives.add(summer)
    indianSummerLabels = viewer.scene.primitives.add(summerLabels)
    const winter = new Cesium.PolylineCollection()
    const winterLabels = new Cesium.LabelCollection()
    addCurrents(winter, winterLabels, INDIAN_WINTER_CURRENTS)
    indianWinterCollection = viewer.scene.primitives.add(winter)
    indianWinterLabels = viewer.scene.primitives.add(winterLabels)
  }

  function buildArrows(viewer: Cesium.Viewer): void {
    const summer = new Cesium.PolylineCollection()
    const winter = new Cesium.PolylineCollection()
    for (const arrow of SUMMER_MONSOON_ARROWS) {
      summer.add({
        positions: arrow.path.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, ARROW_ALTITUDE)),
        width: 16,
        material: Cesium.Material.fromType('PolylineArrow', { color: Cesium.Color.fromCssColorString('#fa8c16') })
      })
    }
    for (const arrow of WINTER_MONSOON_ARROWS) {
      winter.add({
        positions: arrow.path.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, ARROW_ALTITUDE)),
        width: 16,
        material: Cesium.Material.fromType('PolylineArrow', { color: Cesium.Color.fromCssColorString('#2f54eb') })
      })
    }
    summerCollection = viewer.scene.primitives.add(summer)
    winterCollection = viewer.scene.primitives.add(winter)
  }

  function buildClimateZones(viewer: Cesium.Viewer): void {
    const labels = new Cesium.LabelCollection()
    for (const zone of CHINA_CLIMATE_ZONES) {
      climateEntities.push(
        viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(zone.ring.flat())),
            material: Cesium.Color.fromCssColorString(zone.color).withAlpha(0.24)
          }
        })
      )
      labels.add({
        position: Cesium.Cartesian3.fromDegrees(zone.labelAt[0], zone.labelAt[1], 5500),
        text: zone.name,
        font: '13px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.88)'),
        showBackground: true,
        backgroundColor: Cesium.Color.WHITE.withAlpha(0.8),
        backgroundPadding: new Cesium.Cartesian2(6, 3),
        pixelOffset: new Cesium.Cartesian2(0, -6),
        scale: 0.9
      })
    }
    climateLabels = viewer.scene.primitives.add(labels)
  }

  function buildClimateRegions(viewer: Cesium.Viewer): void {
    const labels = new Cesium.LabelCollection()
    for (const region of CLIMATE_REGIONS) {
      climateRegionEntities.push(
        viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(region.ring.flat())),
            material: Cesium.Color.fromCssColorString(region.color).withAlpha(0.22)
          }
        })
      )
      labels.add({
        position: Cesium.Cartesian3.fromDegrees(region.labelAt[0], region.labelAt[1], 5500),
        text: `${region.name} (${region.koppen})`,
        font: '11px sans-serif',
        fillColor: Cesium.Color.fromCssColorString(region.color),
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Cesium.Color.WHITE.withAlpha(0.78),
        backgroundPadding: new Cesium.Cartesian2(6, 3),
        pixelOffset: new Cesium.Cartesian2(0, -4),
        scale: 0.9
      })
    }
    climateRegionLabels = viewer.scene.primitives.add(labels)
  }

  function buildRainband(viewer: Cesium.Viewer): void {
    rainbandEntity = viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(rainBandRing(rainBandForMonth(store.monthPhase)))), false),
        material: new Cesium.ColorMaterialProperty(
          new Cesium.CallbackProperty(() => Cesium.Color.fromCssColorString('#1677ff').withAlpha(rainBandForMonth(store.monthPhase).alpha), false)
        )
      }
    })
    rainbandLabel = viewer.entities.add({
      position: new Cesium.CallbackPositionProperty(() => {
        const band = rainBandForMonth(store.monthPhase)
        return Cesium.Cartesian3.fromDegrees((band.west + band.east) / 2, band.centerLat, 2000)
      }, false),
      label: {
        text: '雨带',
        font: '13px sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.fromCssColorString('#1677ff'),
        outlineWidth: 3,
        pixelOffset: new Cesium.Cartesian2(0, -10)
      }
    })
  }

  function build(viewer: Cesium.Viewer): void {
    built = true
    buildParticles(viewer)
    buildCurrents(viewer)
    buildIndianCurrents(viewer)
    buildArrows(viewer)
    buildClimateZones(viewer)
    buildClimateRegions(viewer)
    buildRainband(viewer)
    const callback = (): void => tick()
    viewer.scene.preUpdate.addEventListener(callback)
    removePreUpdate = () => viewer.scene.preUpdate.removeEventListener(callback)
    applyVisibility()
  }

  function tick(): void {
    const now = performance.now()
    const dt = Math.min(0.12, Math.max(0.001, (now - lastFrame) / 1000))
    lastFrame = now
    if (!particleCollection || !store.showParticles) return
    if (store.playing) store.advancePhase(dt * 0.7)
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i]
      const [u, v] = monsoonWindAt(particle.lon, particle.lat, store.monthPhase)
      particle.lon += u * dt * PARTICLE_SPEED
      particle.lat += v * dt * PARTICLE_SPEED
      particle.age += dt
      if (
        particle.age > particle.life ||
        particle.lon < MONSOON_BOX.west ||
        particle.lon > MONSOON_BOX.east ||
        particle.lat < MONSOON_BOX.south ||
        particle.lat > MONSOON_BOX.north
      ) {
        respawn(particle)
        continue
      }
      const polyline = particlePolylines[i]
      polyline.positions = [
        Cesium.Cartesian3.fromDegrees(particle.lon - u * 0.6, particle.lat - v * 0.6, PARTICLE_ALTITUDE),
        Cesium.Cartesian3.fromDegrees(particle.lon, particle.lat, PARTICLE_ALTITUDE)
      ]
    }
  }

  function isIndianSummer(): boolean {
    return store.monthPhase >= 4.5 && store.monthPhase <= 9.5
  }

  function applyVisibility(): void {
    if (particleCollection) particleCollection.show = store.showParticles
    if (currentCollection) currentCollection.show = store.showCurrents
    if (currentLabels) currentLabels.show = store.showCurrents
    if (indianSummerCollection) indianSummerCollection.show = store.showMonsoonCurrents && isIndianSummer()
    if (indianSummerLabels) indianSummerLabels.show = store.showMonsoonCurrents && isIndianSummer()
    if (indianWinterCollection) indianWinterCollection.show = store.showMonsoonCurrents && !isIndianSummer()
    if (indianWinterLabels) indianWinterLabels.show = store.showMonsoonCurrents && !isIndianSummer()
    if (summerCollection) summerCollection.show = store.showSummerWind
    if (winterCollection) winterCollection.show = store.showWinterWind
    for (const entity of climateEntities) entity.show = store.showClimateZones
    for (const entity of climateRegionEntities) entity.show = store.showClimateRegions
    if (climateRegionLabels) climateRegionLabels.show = store.showClimateRegions
    if (climateLabels) climateLabels.show = store.showClimateZones
    if (rainbandEntity) rainbandEntity.show = store.showRainband
    if (rainbandLabel) rainbandLabel.show = store.showRainband
  }

  watch(() => store.monthPhase, applyVisibility)

  watch(viewerRef, (viewer) => {
    if (viewer && !built && store.panelOpen) build(viewer)
  })

  watch(() => store.panelOpen, (open) => {
    const viewer = currentViewer()
    if (open && viewer && !built) build(viewer)
  })

  watch(
    () => [store.showParticles, store.showRainband, store.showSummerWind, store.showWinterWind, store.showCurrents, store.showClimateZones, store.showClimateRegions],
    applyVisibility
  )

  onBeforeUnmount(() => {
    removePreUpdate?.()
    const viewer = currentViewer()
    if (!viewer) return
    if (particleCollection) viewer.scene.primitives.remove(particleCollection)
    if (currentCollection) viewer.scene.primitives.remove(currentCollection)
    if (indianSummerCollection) viewer.scene.primitives.remove(indianSummerCollection)
    if (indianWinterCollection) viewer.scene.primitives.remove(indianWinterCollection)
    if (summerCollection) viewer.scene.primitives.remove(summerCollection)
    if (winterCollection) viewer.scene.primitives.remove(winterCollection)
    if (currentLabels) viewer.scene.primitives.remove(currentLabels)
    if (indianSummerLabels) viewer.scene.primitives.remove(indianSummerLabels)
    if (indianWinterLabels) viewer.scene.primitives.remove(indianWinterLabels)
    if (climateLabels) viewer.scene.primitives.remove(climateLabels)
    if (rainbandEntity) viewer.entities.remove(rainbandEntity)
    if (rainbandLabel) viewer.entities.remove(rainbandLabel)
    for (const entity of climateEntities) viewer.entities.remove(entity)
    for (const entity of climateRegionEntities) viewer.entities.remove(entity)
    if (climateRegionLabels) viewer.scene.primitives.remove(climateRegionLabels)
    climateRegionLabels = null
    climateRegionEntities.length = 0
    particleCollection = null
    currentCollection = null
    indianSummerCollection = null
    indianWinterCollection = null
    summerCollection = null
    winterCollection = null
    currentLabels = null
    indianSummerLabels = null
    indianWinterLabels = null
    climateLabels = null
    rainbandEntity = null
    rainbandLabel = null
    climateEntities.length = 0
    particles.length = 0
    particlePolylines.length = 0
  })
}
