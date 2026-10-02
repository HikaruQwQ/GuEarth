import { registerTeachingLayer } from '../registry'
import { defineRouteLayer } from '../renderers'

registerTeachingLayer(defineRouteLayer({
  id: 'china-water-transfer',
  name: '南水北调',
  category: 'human',
  description: '东、中、西三条调水线路',
  flyTo: { longitude: 112, latitude: 34, height: 4500000 },
  routes: [
    {
      name: '东线',
      color: '#1677ff',
      path: [[119.5, 32.4], [119.4, 33.6], [119.3, 34.8], [118.9, 36.4], [117.8, 37.6], [117.0, 38.6], [116.6, 39.3]],
      labelAt: [119.6, 34.2]
    },
    {
      name: '中线',
      color: '#13c2c2',
      path: [[111.5, 32.6], [112.5, 33.0], [113.6, 34.7], [114.5, 38.0], [116.3, 39.7]],
      labelAt: [112.4, 36.5]
    },
    {
      name: '西线（规划）',
      color: '#722ed1',
      path: [[100.8, 31.2], [101.8, 32.6], [102.3, 34.0], [102.2, 35.4]],
      labelAt: [100.4, 33.4]
    }
  ]
}))

registerTeachingLayer(defineRouteLayer({
  id: 'west-east-gas',
  name: '西气东输',
  category: 'human',
  description: '一线、二线天然气管道走向',
  flyTo: { longitude: 100, latitude: 36, height: 5500000 },
  routes: [
    {
      name: '一线',
      color: '#fa8c16',
      path: [[84.2, 41.6], [90.5, 42.6], [96.5, 41.0], [100.5, 39.2], [104.8, 37.6], [107.4, 35.8], [110.4, 34.6], [113.6, 34.7], [116.0, 33.5], [118.8, 32.0], [121.5, 31.2]],
      labelAt: [95.5, 43.8]
    },
    {
      name: '二线',
      color: '#fa541c',
      path: [[80.4, 44.2], [85.6, 43.6], [91.0, 43.6], [96.5, 40.5], [101.5, 38.0], [105.8, 35.6], [109.8, 33.6], [113.0, 31.0], [115.9, 28.7], [113.4, 23.1]],
      labelAt: [78.6, 42.4]
    }
  ]
}))

registerTeachingLayer(defineRouteLayer({
  id: 'west-east-power',
  name: '西电东送通道',
  category: 'human',
  description: '北、中、南三大输电通道',
  flyTo: { longitude: 108, latitude: 33, height: 5500000 },
  routes: [
    {
      name: '北通道（火电）',
      color: '#eb2f96',
      path: [[112.4, 37.8], [113.5, 38.4], [114.5, 38.8], [116.4, 39.9]],
      labelAt: [111.6, 39.4]
    },
    {
      name: '中通道（水电）',
      color: '#2f54eb',
      path: [[104.4, 28.6], [107.4, 30.2], [111.0, 30.7], [114.0, 30.4], [117.5, 31.4], [121.5, 31.2]],
      labelAt: [105.6, 27.4]
    },
    {
      name: '南通道（水电）',
      color: '#52c41a',
      path: [[100.2, 25.4], [102.8, 24.6], [105.5, 24.6], [108.5, 23.6], [111.0, 23.2], [113.4, 23.1]],
      labelAt: [99.4, 23.0]
    }
  ]
}))

registerTeachingLayer(defineRouteLayer({
  id: 'oil-import-routes',
  name: '石油进口海上通道',
  category: 'human',
  description: '中东航线与中缅油气管道',
  flyTo: { longitude: 95, latitude: 15, height: 7000000 },
  routes: [
    {
      name: '中东航线（经马六甲）',
      color: '#d4380d',
      path: [[56.5, 26.4], [60.0, 20.0], [64.0, 12.0], [70.0, 7.0], [82.0, 4.5], [95.0, 3.5], [100.5, 2.4], [106.0, 5.0], [110.5, 10.0], [117.0, 18.0], [121.8, 29.9]],
      labelAt: [72.0, 9.4]
    },
    {
      name: '中缅油气管道',
      color: '#faad14',
      path: [[93.6, 19.8], [96.5, 22.4], [99.5, 24.0], [102.7, 25.0], [105.0, 27.5], [106.5, 29.6]],
      labelAt: [95.6, 19.0]
    }
  ]
}))
