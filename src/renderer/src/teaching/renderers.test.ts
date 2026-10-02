import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Cesium from 'cesium'
import { definePointSetLayer } from './renderers'

beforeEach(() => {
  vi.stubGlobal('document', {
    createElement: () => ({ style: {} }),
    body: { appendChild: () => undefined, removeChild: () => undefined },
    defaultView: {
      getComputedStyle: () => ({
        getPropertyValue: (property: string) => (property === 'font-size' ? '12px' : property === 'font-family' ? 'sans-serif' : 'normal')
      })
    }
  })
})

interface StubViewer {
  scene: {
    ellipsoid: Cesium.Ellipsoid
    frameState: { mode: Cesium.SceneMode }
    updateHeight: () => () => void
    getHeight: () => number
    primitives: { add: (collection: Cesium.Primitive) => Cesium.Primitive; remove: (collection: Cesium.Primitive) => boolean }
  }
}

function stubViewer(added: Cesium.Primitive[], removed: Cesium.Primitive[]): StubViewer {
  return {
    scene: {
      ellipsoid: Cesium.Ellipsoid.WGS84,
      frameState: { mode: Cesium.SceneMode.SCENE3D },
      updateHeight: () => () => undefined,
      getHeight: () => 0,
      primitives: {
        add: (collection) => {
          added.push(collection)
          return collection
        },
        remove: (collection) => {
          removed.push(collection)
          return true
        }
      }
    }
  }
}

const spec = {
  id: 'test-points',
  name: '测试点集',
  category: 'human' as const,
  color: '#52c41a',
  points: [
    { lon: 132.5, lat: 46.8, name: '三江平原' },
    { lon: 125.4, lat: 46.0, name: '松嫩平原' },
    { lon: 117.5, lat: 32.4, name: '江淮地区' },
    { lon: 112.6, lat: 30.3, name: '江汉平原' },
    { lon: 112.8, lat: 28.9, name: '洞庭湖平原' },
    { lon: 116.3, lat: 28.8, name: '鄱阳湖平原' },
    { lon: 120.5, lat: 31.2, name: '太湖平原' },
    { lon: 103.8, lat: 30.7, name: '成都平原' },
    { lon: 113.5, lat: 23.0, name: '珠江三角洲' }
  ]
}

describe('definePointSetLayer', () => {
  it('adds every point and label when labels clamp to ground', () => {
    const added: Cesium.Primitive[] = []
    const viewer = stubViewer(added, [])
    const handle = definePointSetLayer(spec).create(viewer as unknown as Cesium.Viewer)
    const points = added.find((collection) => collection instanceof Cesium.PointPrimitiveCollection) as Cesium.PointPrimitiveCollection
    const labels = added.find((collection) => collection instanceof Cesium.LabelCollection) as Cesium.LabelCollection
    expect(points.length).toBe(spec.points.length)
    expect(labels.length).toBe(spec.points.length)
    handle.setVisible(false)
    handle.setVisible(true)
  })

  it('disposes its primitive collections', () => {
    const removed: Cesium.Primitive[] = []
    const viewer = stubViewer([], removed)
    const handle = definePointSetLayer(spec).create(viewer as unknown as Cesium.Viewer)
    handle.dispose()
    expect(removed).toHaveLength(2)
  })

  it('rejects clamped labels on a scene-less collection', () => {
    const collection = new Cesium.LabelCollection()
    expect(() => collection.add({ text: 'x', position: Cesium.Cartesian3.fromDegrees(110, 30), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND })).toThrow(Cesium.DeveloperError)
  })
})
