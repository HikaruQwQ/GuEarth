import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import { thematicLayerCatalog, useClimateStore, type ThematicLayerId } from '@renderer/stores/climate'
import { beltLabel, beltLabelPosition, beltOpacity, beltRing } from '@renderer/thematic/rainBelt'
import { summerMonsoonArrows, winterMonsoonArrows, type MonsoonArrow } from '@renderer/thematic/monsoonArrows'
import { oceanCurrents, pathPointAt } from '@renderer/thematic/oceanCurrents'
import { climateZones } from '@renderer/thematic/climateZones'
import { coriolisDemos, sampleTrack } from '@renderer/thematic/coriolis'

const WARM_COLOR = '#f5222d'
const COLD_COLOR = '#1677ff'
const RAIN_BELT_COLOR = '#1677ff'
const CORIOLIS_NORTH_COLOR = '#1677ff'
const CORIOLIS_SOUTH_COLOR = '#fa8c16'
const CORIOLIS_INERTIAL_COLOR = 'rgba(0, 0, 0, 0.45)'
const LABEL_FONT_FAMILY = '"Microsoft YaHei", "PingFang SC", sans-serif'

interface LayerView {
  longitude: number
  latitude: number
  height: number
}

function labelFont(size: number, weight = 400): string {
  return `${weight === 400 ? '' : `${weight} `}${size}px ${LABEL_FONT_FAMILY}`
}

function toCartesians(points: Array<[number, number]>): Cesium.Cartesian3[] {
  return Cesium.Cartesian3.fromDegreesArray(points.flat())
}

function arrowHeadPositions(from: [number, number], to: [number, number], size: number): Cesium.Cartesian3[] {
  const latMidRad = (((from[1] + to[1]) / 2) * Math.PI) / 180
  const cosLat = Math.max(0.25, Math.cos(latMidRad))
  const dx = (to[0] - from[0]) * cosLat
  const dy = to[1] - from[1]
  const norm = Math.hypot(dx, dy) || 1
  const dirX = dx / norm
  const dirY = dy / norm
  const perpX = -dirY
  const perpY = dirX
  const tipLon = to[0] + (dirX * size) / cosLat
  const tipLat = to[1] + dirY * size
  const baseLon = to[0] - (dirX * size * 1.6) / cosLat
  const baseLat = to[1] - dirY * size * 1.6
  return Cesium.Cartesian3.fromDegreesArray([
    tipLon, tipLat,
    baseLon + (perpX * size) / cosLat, baseLat + perpY * size,
    baseLon - (perpX * size) / cosLat, baseLat - perpY * size
  ])
}

function arrowLabelAt(arrow: MonsoonArrow): [number, number] {
  const latMidRad = (((arrow.from[1] + arrow.to[1]) / 2) * Math.PI) / 180
  const cosLat = Math.max(0.25, Math.cos(latMidRad))
  const dx = (arrow.to[0] - arrow.from[0]) * cosLat
  const dy = arrow.to[1] - arrow.from[1]
  const norm = Math.hypot(dx, dy) || 1
  const perpX = dy / norm
  const perpY = -dx / norm
  return [
    (arrow.from[0] + arrow.to[0]) / 2 + (perpX * 3.4) / cosLat,
    (arrow.from[1] + arrow.to[1]) / 2 + perpY * 3.4
  ]
}

export function useThematicLayers(viewer: Ref<Cesium.Viewer | undefined>): void {
  const store = useClimateStore()
  const sources = new Map<ThematicLayerId, Cesium.CustomDataSource>()
  const coriolisProgress = ref(0)
  let coriolisRaf = 0
  let coriolisLast = 0

  function coriolisTick(now: number): void {
    coriolisRaf = requestAnimationFrame(coriolisTick)
    const dt = coriolisLast > 0 ? Math.min(0.05, (now - coriolisLast) / 1000) : 0
    coriolisLast = now
    if (dt > 0) coriolisProgress.value = (coriolisProgress.value + dt / 10) % 1
  }

  function startCoriolis(): void {
    if (!coriolisRaf) {
      coriolisLast = 0
      coriolisRaf = requestAnimationFrame(coriolisTick)
    }
  }

  function stopCoriolis(): void {
    if (coriolisRaf) {
      cancelAnimationFrame(coriolisRaf)
      coriolisRaf = 0
    }
  }

  function buildRainBelt(dataSource: Cesium.CustomDataSource): void {
    dataSource.entities.add({
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(beltRing(store.month))), false),
        material: new Cesium.ColorMaterialProperty(
          new Cesium.CallbackProperty(() => Cesium.Color.fromCssColorString(RAIN_BELT_COLOR).withAlpha(beltOpacity(store.month) * 0.7), false)
        ),
        show: new Cesium.CallbackProperty(() => beltOpacity(store.month) > 0.02, false)
      },
      position: new Cesium.CallbackPositionProperty(() => {
        const [lon, lat] = beltLabelPosition(store.month)
        return Cesium.Cartesian3.fromDegrees(lon, lat)
      }, false, Cesium.ReferenceFrame.FIXED),
      label: {
        text: new Cesium.CallbackProperty(() => beltLabel(store.month), false),
        show: new Cesium.CallbackProperty(() => beltOpacity(store.month) > 0.05 && beltLabel(store.month) !== '', false),
        font: labelFont(15, 600),
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString(RAIN_BELT_COLOR),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: 10_000
      }
    })
  }

  function buildMonsoonArrows(dataSource: Cesium.CustomDataSource, season: 'summer' | 'winter'): void {
    const color = Cesium.Color.fromCssColorString(season === 'summer' ? WARM_COLOR : COLD_COLOR)
    const arrows = season === 'summer' ? summerMonsoonArrows : winterMonsoonArrows
    const labeled = new Set<string>()
    for (const arrow of arrows) {
      dataSource.entities.add({
        polyline: {
          positions: toCartesians([arrow.from, arrow.to]),
          clampToGround: true,
          width: 4,
          material: color.withAlpha(0.82)
        }
      })
      dataSource.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(arrowHeadPositions(arrow.from, arrow.to, 2.2)),
          material: color.withAlpha(0.95)
        }
      })
      if (!labeled.has(arrow.label)) {
        labeled.add(arrow.label)
        const [lon, lat] = arrowLabelAt(arrow)
        dataSource.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          label: {
            text: arrow.label,
            font: labelFont(13, 600),
            fillColor: color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: 10_000
          }
        })
      }
    }
  }

  function buildOceanCurrents(dataSource: Cesium.CustomDataSource): void {
    for (const current of oceanCurrents) {
      const color = Cesium.Color.fromCssColorString(current.kind === 'warm' ? WARM_COLOR : COLD_COLOR)
      const seasonal = current.season !== undefined
      const show = seasonal
        ? new Cesium.CallbackProperty(
          () => (current.season === 'summer' ? store.summerStrength : store.winterStrength) > 0.5,
          false
        )
        : undefined
      dataSource.entities.add({
        polyline: {
          positions: toCartesians(current.path),
          clampToGround: true,
          width: current.major ? 4.5 : 3,
          material: color.withAlpha(0.8),
          show
        }
      })
      for (const fraction of [0.35, 0.8]) {
        const back = pathPointAt(current.path, fraction)
        const front = pathPointAt(current.path, fraction + 0.03)
        dataSource.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(arrowHeadPositions(back.position, front.position, 1.5)),
            material: color.withAlpha(0.9),
            show
          }
        })
      }
      const mid = pathPointAt(current.path, 0.55)
      dataSource.entities.add({
        position: Cesium.Cartesian3.fromDegrees(mid.position[0], mid.position[1]),
        label: {
          text: current.name,
          font: labelFont(12),
          fillColor: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: 10_000,
          show
        }
      })
    }
  }

  function buildClimateZones(dataSource: Cesium.CustomDataSource): void {
    for (const zone of climateZones) {
      const color = Cesium.Color.fromCssColorString(zone.color)
      for (const ring of zone.rings) {
        dataSource.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(toCartesians(ring)),
            material: new Cesium.ColorMaterialProperty(color.withAlpha(0.28))
          }
        })
        dataSource.entities.add({
          polyline: {
            positions: toCartesians(ring),
            clampToGround: true,
            width: 2,
            material: color.withAlpha(0.85)
          }
        })
      }
      dataSource.entities.add({
        position: Cesium.Cartesian3.fromDegrees(zone.labelAt[0], zone.labelAt[1]),
        label: {
          text: zone.name,
          font: labelFont(14, 600),
          fillColor: color,
          showBackground: true,
          backgroundColor: Cesium.Color.WHITE.withAlpha(0.72),
          backgroundPadding: new Cesium.Cartesian2(7, 4),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: 10_000
        }
      })
    }
  }

  function buildCoriolis(dataSource: Cesium.CustomDataSource): void {
    startCoriolis()
    const inertialColor = Cesium.Color.fromCssColorString(CORIOLIS_INERTIAL_COLOR)
    for (const demo of coriolisDemos) {
      const deflectedColor = Cesium.Color.fromCssColorString(demo.id === 'north' ? CORIOLIS_NORTH_COLOR : CORIOLIS_SOUTH_COLOR)
      dataSource.entities.add({
        polyline: {
          positions: toCartesians(demo.inertial),
          clampToGround: true,
          width: 2,
          material: new Cesium.PolylineDashMaterialProperty({ color: inertialColor })
        }
      })
      dataSource.entities.add({
        polyline: {
          positions: toCartesians(demo.deflected),
          clampToGround: true,
          width: 3.5,
          material: deflectedColor.withAlpha(0.9)
        }
      })
      for (const track of [demo.inertial, demo.deflected]) {
        const isDeflected = track === demo.deflected
        dataSource.entities.add({
          position: new Cesium.CallbackPositionProperty(() => {
            const [lon, lat] = sampleTrack(track, coriolisProgress.value)
            return Cesium.Cartesian3.fromDegrees(lon, lat)
          }, false, Cesium.ReferenceFrame.FIXED),
          point: {
            pixelSize: 9,
            color: isDeflected ? deflectedColor : Cesium.Color.fromCssColorString('rgba(0, 0, 0, 0.65)'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: 10_000
          }
        })
      }
      const deflectedEnd = demo.deflected[demo.deflected.length - 1]
      dataSource.entities.add({
        position: Cesium.Cartesian3.fromDegrees(demo.start[0], demo.start[1]),
        label: {
          text: demo.label,
          font: labelFont(13, 600),
          fillColor: Cesium.Color.WHITE,
          outlineColor: deflectedColor,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: 10_000
        }
      })
      dataSource.entities.add({
        position: Cesium.Cartesian3.fromDegrees(deflectedEnd[0], deflectedEnd[1]),
        label: {
          text: demo.id === 'north' ? '向右偏转' : '向左偏转',
          font: labelFont(12, 600),
          fillColor: deflectedColor,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: 10_000
        }
      })
    }
  }

  const builders: Record<ThematicLayerId, (dataSource: Cesium.CustomDataSource) => void> = {
    'wind-particles': () => undefined,
    'rain-belt': buildRainBelt,
    'summer-monsoon': (dataSource) => buildMonsoonArrows(dataSource, 'summer'),
    'winter-monsoon': (dataSource) => buildMonsoonArrows(dataSource, 'winter'),
    'ocean-currents': buildOceanCurrents,
    'climate-zones': buildClimateZones,
    'coriolis-demo': buildCoriolis
  }

  const enableViews: Partial<Record<ThematicLayerId, LayerView>> = {
    'rain-belt': { longitude: 112, latitude: 30, height: 4500000 },
    'summer-monsoon': { longitude: 96, latitude: 24, height: 7500000 },
    'winter-monsoon': { longitude: 108, latitude: 32, height: 7500000 },
    'climate-zones': { longitude: 104, latitude: 34, height: 5200000 },
    'coriolis-demo': { longitude: 100, latitude: 0, height: 12000000 }
  }

  function syncOverlays(): void {
    const current = viewer.value
    if (!current || current.isDestroyed()) return
    for (const layer of thematicLayerCatalog) {
      const enabled = store.overlays[layer.id]
      const existing = sources.get(layer.id)
      if (enabled && !existing) {
        const dataSource = new Cesium.CustomDataSource(layer.id)
        builders[layer.id](dataSource)
        void current.dataSources.add(dataSource)
        sources.set(layer.id, dataSource)
        const view = enableViews[layer.id]
        if (view) current.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(view.longitude, view.latitude, view.height), duration: 1.2 })
      } else if (!enabled && existing) {
        current.dataSources.remove(existing, true)
        sources.delete(layer.id)
        if (layer.id === 'coriolis-demo') stopCoriolis()
      }
    }
  }

  watch(() => store.overlays, syncOverlays, { deep: true })
  watch(viewer, (previous) => {
    if (previous && !previous.isDestroyed()) sources.clear()
    syncOverlays()
  })

  onBeforeUnmount(stopCoriolis)
}
