import * as Cesium from 'cesium'
import { registerTeachingLayer, type TeachingLayerHandle } from '../registry'

const ALTITUDE = 12000
const GRID_COLOR = 'rgba(90, 105, 125, 0.55)'
const SPECIAL_LINES = [
  { lat: 0, name: '赤道（0°）', color: '#595959', dash: false },
  { lat: 23.44, name: '北回归线（23.5°N）', color: '#fa8c16', dash: true },
  { lat: -23.44, name: '南回归线（23.5°S）', color: '#fa8c16', dash: true },
  { lat: 66.56, name: '北极圈（66.5°N）', color: '#2f54eb', dash: true },
  { lat: -66.56, name: '南极圈（66.5°S）', color: '#2f54eb', dash: true }
]

function meridianLabel(lon: number): string {
  if (lon === 0) return '0°'
  if (lon === 180 || lon === -180) return '180°'
  return `${Math.abs(lon)}°${lon > 0 ? 'E' : 'W'}`
}

registerTeachingLayer({
  id: 'graticule',
  name: '经纬网',
  category: 'skills',
  description: '经线、纬网与五带分界线',
  legend: [
    { color: '#595959', label: '赤道', shape: 'line' },
    { color: '#fa8c16', label: '回归线', shape: 'dash' },
    { color: '#2f54eb', label: '极圈', shape: 'dash' }
  ],
  create(viewer: Cesium.Viewer): TeachingLayerHandle {
    const collection = viewer.scene.primitives.add(new Cesium.PolylineCollection())
    const labels = viewer.scene.primitives.add(new Cesium.LabelCollection())
    const gridColor = Cesium.Color.fromCssColorString(GRID_COLOR)
    for (let lon = -180; lon <= 180; lon += 30) {
      const positions: Cesium.Cartesian3[] = []
      for (let lat = -85; lat <= 85; lat += 5) positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, ALTITUDE))
      collection.add({
        positions,
        width: lon === 0 ? 1.6 : 1,
        material: Cesium.Material.fromType('Color', { color: gridColor })
      })
      labels.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lon === 0 ? 8 : 3, ALTITUDE + 800),
        text: meridianLabel(lon),
        font: '12px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#5a697d'),
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
        outlineWidth: 3,
        scale: 0.9
      })
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      if (lat === 0) continue
      const positions: Cesium.Cartesian3[] = []
      for (let lon = -180; lon <= 180; lon += 5) positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, ALTITUDE))
      collection.add({
        positions,
        width: 1,
        material: Cesium.Material.fromType('Color', { color: gridColor })
      })
      labels.add({
        position: Cesium.Cartesian3.fromDegrees(-170, lat, ALTITUDE + 800),
        text: `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`,
        font: '12px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#5a697d'),
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
        outlineWidth: 3,
        scale: 0.9
      })
    }
    for (const special of SPECIAL_LINES) {
      const color = Cesium.Color.fromCssColorString(special.color).withAlpha(0.9)
      const positions: Cesium.Cartesian3[] = []
      for (let lon = -180; lon <= 180; lon += 5) positions.push(Cesium.Cartesian3.fromDegrees(lon, special.lat, ALTITUDE))
      collection.add({
        positions,
        width: 2.4,
        material: special.dash
          ? Cesium.Material.fromType('PolylineDash', { color, dashLength: 20 })
          : Cesium.Material.fromType('Color', { color })
      })
      labels.add({
        position: Cesium.Cartesian3.fromDegrees(160, special.lat, ALTITUDE + 800),
        text: special.name,
        font: '12px sans-serif',
        fillColor: Cesium.Color.fromCssColorString(special.color),
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
        outlineWidth: 3,
        scale: 0.9
      })
    }
    return {
      setVisible(visible: boolean): void {
        collection.show = visible
        labels.show = visible
      },
      dispose(): void {
        viewer.scene.primitives.remove(collection)
        viewer.scene.primitives.remove(labels)
      }
    }
  }
})
