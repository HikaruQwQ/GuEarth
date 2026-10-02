import { describe, expect, it } from 'vitest'
import { buildKml, cssToKmlColor, kmlColorToCss, parseCoordinateText } from './kml'
import type { AnnotationData, AnnotationGroup, GroundOverlayData } from '../../../preload/types'

function makeAnnotation(overrides: Partial<AnnotationData> = {}): AnnotationData {
  return {
    id: 'anno-1',
    kind: 'point',
    name: '测试点',
    points: [[116.4, 39.9]],
    distanceKm: null,
    areaKm2: null,
    createdAt: 1700000000000,
    groupId: null,
    visible: true,
    style: { color: '#ff0000', lineWidth: 3, fillOpacity: 0.28, icon: 'circle', iconScale: 1 },
    ...overrides
  }
}

describe('kmlColorToCss', () => {
  it('converts aabbggrr kml color to css rgb and alpha', () => {
    expect(kmlColorToCss('ffff0000')).toEqual({ color: '#0000ff', alpha: 1 })
    expect(kmlColorToCss('80ff0000').alpha).toBeCloseTo(0.502, 2)
    expect(kmlColorToCss('bad')).toEqual({ color: '#1677ff', alpha: 1 })
  })
})

describe('cssToKmlColor', () => {
  it('converts css hex with alpha to aabbggrr', () => {
    expect(cssToKmlColor('#ff0000', 1)).toBe('ff0000ff')
    expect(cssToKmlColor('#336699', 0.5)).toBe('80996633')
    expect(cssToKmlColor('#0000ff', 1)).toBe('ffff0000')
  })
})

describe('parseCoordinateText', () => {
  it('parses lon,lat,alt tuples separated by whitespace', () => {
    expect(parseCoordinateText('116.4,39.9,0 121.47,31.23,10')).toEqual([[116.4, 39.9], [121.47, 31.23]])
    expect(parseCoordinateText('not,a,coord')).toEqual([])
  })
})

describe('buildKml', () => {
  const group: AnnotationGroup = { id: 'group-1', name: '分组 <中国>', createdAt: 1700000000000 }
  const overlay: GroundOverlayData = {
    id: 'overlay-1',
    name: '历史地图',
    assetDir: '0123456789abcdef',
    fileName: 'map.png',
    remoteUrl: null,
    west: 100,
    south: 20,
    east: 120,
    north: 40,
    opacity: 0.8,
    visible: true,
    createdAt: 1700000000000
  }

  it('escapes xml entities in names and emits folders', () => {
    const { kml, assets } = buildKml('导出 <测试>', [group], [makeAnnotation({ groupId: 'group-1', name: '长江 & 黄河' })], [], () => '')
    expect(kml).toContain('<name>导出 &lt;测试&gt;</name>')
    expect(kml).toContain('<name>分组 &lt;中国&gt;</name>')
    expect(kml).toContain('<name>长江 &amp; 黄河</name>')
    expect(kml).toContain('<Folder>')
    expect(assets).toEqual([])
  })

  it('emits geometry and measurement extended data', () => {
    const line = makeAnnotation({ kind: 'line', points: [[116, 39], [117, 40]], distanceKm: 140.4, style: { color: '#00ff00', lineWidth: 5, fillOpacity: 0.2, icon: 'circle', iconScale: 1 } })
    const polygon = makeAnnotation({ kind: 'polygon', points: [[116, 39], [117, 39], [117, 40]], areaKm2: 9500 })
    const { kml } = buildKml('test', [], [line, polygon], [], () => '')
    expect(kml).toContain('<LineString>')
    expect(kml).toContain('<width>5</width>')
    expect(kml).toContain('<Data name="distanceKm"><value>140.4</value></Data>')
    expect(kml).toContain('<Polygon>')
    expect(kml).toContain('<Data name="areaKm2"><value>9500</value></Data>')
  })

  it('collects overlay assets for kmz packaging', () => {
    const { kml, assets } = buildKml('test', [], [], [overlay], (item) => `files/${item.fileName}`)
    expect(kml).toContain('<GroundOverlay>')
    expect(kml).toContain('<href>files/map.png</href>')
    expect(assets).toEqual([{ assetDir: '0123456789abcdef', fileName: 'map.png', zipPath: 'files/map.png' }])
  })
})
