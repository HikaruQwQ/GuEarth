import * as Cesium from 'cesium'
import type { TeachingLayerDefinition, TeachingLayerHandle } from './registry'

export interface TeachingPoint {
  lon: number
  lat: number
  name: string
  note?: string
}

export interface PointSetSpec {
  id: string
  name: string
  category: TeachingLayerDefinition['category']
  description?: string
  legend?: TeachingLayerDefinition['legend']
  flyTo?: TeachingLayerDefinition['flyTo']
  color: string
  labelColor?: string
  points: TeachingPoint[]
}

export interface RouteDefinition {
  name: string
  color: string
  path: Array<[number, number]>
  labelAt: [number, number]
  note?: string
}

export interface RouteSetSpec {
  id: string
  name: string
  category: TeachingLayerDefinition['category']
  description?: string
  legend?: TeachingLayerDefinition['legend']
  flyTo?: TeachingLayerDefinition['flyTo']
  routes: RouteDefinition[]
}

const ALTITUDE = 2000

function disposeCollections(viewer: Cesium.Viewer, collections: Array<Cesium.Primitive | undefined>): void {
  for (const collection of collections) {
    if (collection && !collection.isDestroyed()) viewer.scene.primitives.remove(collection)
  }
}

export function definePointSetLayer(spec: PointSetSpec): TeachingLayerDefinition {
  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    description: spec.description,
    legend: spec.legend,
    flyTo: spec.flyTo,
    create(viewer: Cesium.Viewer): TeachingLayerHandle {
      const points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection())
      const labels = viewer.scene.primitives.add(new Cesium.LabelCollection())
      const color = Cesium.Color.fromCssColorString(spec.color)
      const labelColor = Cesium.Color.fromCssColorString(spec.labelColor ?? spec.color)
      for (const point of spec.points) {
        const position = Cesium.Cartesian3.fromDegrees(point.lon, point.lat)
        points.add({
          position,
          pixelSize: 9,
          color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1.5,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        })
        labels.add({
          position,
          text: point.note ? `${point.name}（${point.note}）` : point.name,
          font: '12px sans-serif',
          fillColor: labelColor,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
          outlineWidth: 3,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          scale: 0.9,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        })
      }
      return {
        setVisible(visible: boolean): void {
          points.show = visible
          labels.show = visible
        },
        dispose(): void {
          disposeCollections(viewer, [points, labels])
        }
      }
    }
  }
}

function bearingDegrees(from: Cesium.Cartesian3, to: Cesium.Cartesian3): number {
  const fromCartographic = Cesium.Cartographic.fromCartesian(from)
  const toCartographic = Cesium.Cartographic.fromCartesian(to)
  const y = Math.sin(Cesium.Math.toRadians(toCartographic.longitude - fromCartographic.longitude)) * Math.cos(Cesium.Math.toRadians(toCartographic.latitude))
  const x = Math.cos(Cesium.Math.toRadians(fromCartographic.latitude)) * Math.sin(Cesium.Math.toRadians(toCartographic.latitude)) - Math.sin(Cesium.Math.toRadians(fromCartographic.latitude)) * Math.cos(Cesium.Math.toRadians(toCartographic.latitude)) * Math.cos(Cesium.Math.toRadians(toCartographic.longitude - fromCartographic.longitude))
  return (Cesium.Math.toDegrees(Math.atan2(y, x)) + 360) % 360
}

function destination(from: Cesium.Cartesian3, bearingDeg: number, distanceDeg: number): Cesium.Cartesian3 {
  const cartographic = Cesium.Cartographic.fromCartesian(from)
  const bearing = Cesium.Math.toRadians(bearingDeg)
  const latitude = Cesium.Math.toRadians(cartographic.latitude)
  const longitude = Cesium.Math.toRadians(cartographic.longitude)
  const angular = Cesium.Math.toRadians(distanceDeg)
  const nextLatitude = Math.asin(Math.sin(latitude) * Math.cos(angular) + Math.cos(latitude) * Math.sin(angular) * Math.cos(bearing))
  const nextLongitude = longitude + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(latitude), Math.cos(angular) - Math.sin(latitude) * Math.sin(nextLatitude))
  return Cesium.Cartesian3.fromRadians(nextLongitude, nextLatitude, ALTITUDE)
}

function arrowHeads(positions: Cesium.Cartesian3[], color: Cesium.Color, collection: Cesium.PolylineCollection): void {
  const wingBearing = 152
  for (let index = 0; index < positions.length - 1; index += 1) {
    const from = positions[index]
    const to = positions[index + 1]
    const distanceMeters = Cesium.Cartesian3.distance(from, to)
    const wingLength = Math.min(0.9, Math.max(0.25, distanceMeters / 450000))
    const bearing = bearingDegrees(from, to)
    collection.add({
      positions: [to, destination(to, bearing + wingBearing, wingLength)],
      width: 2,
      material: Cesium.Material.fromType('Color', { color })
    })
    collection.add({
      positions: [to, destination(to, bearing - wingBearing, wingLength)],
      width: 2,
      material: Cesium.Material.fromType('Color', { color })
    })
  }
}

export function defineRouteLayer(spec: RouteSetSpec): TeachingLayerDefinition {
  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    description: spec.description,
    legend: spec.legend,
    flyTo: spec.flyTo,
    create(viewer: Cesium.Viewer): TeachingLayerHandle {
      const collection = viewer.scene.primitives.add(new Cesium.PolylineCollection())
      const labels = viewer.scene.primitives.add(new Cesium.LabelCollection())
      for (const route of spec.routes) {
        const color = Cesium.Color.fromCssColorString(route.color).withAlpha(0.9)
        const positions = route.path.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, ALTITUDE))
        collection.add({
          positions,
          width: 3,
          material: Cesium.Material.fromType('Color', { color })
        })
        arrowHeads(positions, color, collection)
        labels.add({
          position: Cesium.Cartesian3.fromDegrees(route.labelAt[0], route.labelAt[1], ALTITUDE + 800),
          text: route.name,
          font: '12px sans-serif',
          fillColor: Cesium.Color.fromCssColorString(route.color),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
          outlineWidth: 3,
          pixelOffset: new Cesium.Cartesian2(0, -8),
          scale: 0.9
        })
      }
      return {
        setVisible(visible: boolean): void {
          collection.show = visible
          labels.show = visible
        },
        dispose(): void {
          disposeCollections(viewer, [collection, labels])
        }
      }
    }
  }
}
