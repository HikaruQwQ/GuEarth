import { registerTeachingLayer } from '../registry'
import { definePointSetLayer } from '../renderers'

registerTeachingLayer(definePointSetLayer({
  id: 'china-grain-bases',
  name: '九大商品粮基地',
  category: 'human',
  description: '全国性商品粮基地的分布',
  color: '#52c41a',
  flyTo: { longitude: 110, latitude: 33, height: 6500000 },
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
}))
