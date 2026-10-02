import { registerTeachingLayer } from '../registry'
import { definePointSetLayer } from '../renderers'

registerTeachingLayer(definePointSetLayer({
  id: 'china-nuclear-plants',
  name: '中国主要核电站',
  category: 'human',
  description: '可叠加“板块构造”图层讨论选址与地震带',
  color: '#722ed1',
  flyTo: { longitude: 114, latitude: 29, height: 4500000 },
  points: [
    { lon: 114.55, lat: 22.6, name: '大亚湾', note: '在运' },
    { lon: 114.62, lat: 22.68, name: '岭澳', note: '在运' },
    { lon: 114.9, lat: 22.85, name: '太平岭', note: '在建' },
    { lon: 112.35, lat: 21.9, name: '台山', note: '在运' },
    { lon: 111.85, lat: 21.75, name: '阳江', note: '在运' },
    { lon: 108.35, lat: 21.7, name: '防城港', note: '在运' },
    { lon: 108.95, lat: 19.5, name: '昌江', note: '在运' },
    { lon: 117.9, lat: 24.0, name: '漳州', note: '在建' },
    { lon: 119.45, lat: 25.5, name: '福清', note: '在运' },
    { lon: 119.95, lat: 26.7, name: '宁德', note: '在运' },
    { lon: 121.65, lat: 29.05, name: '三门', note: '在运' },
    { lon: 120.95, lat: 30.35, name: '秦山', note: '在运' },
    { lon: 119.45, lat: 34.7, name: '田湾', note: '在运' },
    { lon: 121.15, lat: 36.75, name: '海阳', note: '在运' },
    { lon: 122.4, lat: 37.0, name: '石岛湾', note: '在建' },
    { lon: 121.5, lat: 39.8, name: '红沿河', note: '在运' }
  ]
}))

registerTeachingLayer(definePointSetLayer({
  id: 'china-hydro-stations',
  name: '主要梯级水电站',
  category: 'human',
  description: '长江干流、黄河上游与西南诸河的开发',
  color: '#1677ff',
  flyTo: { longitude: 103, latitude: 30, height: 4500000 },
  points: [
    { lon: 102.35, lat: 26.05, name: '乌东德', note: '金沙江' },
    { lon: 102.88, lat: 27.13, name: '白鹤滩', note: '金沙江' },
    { lon: 103.65, lat: 28.25, name: '溪洛渡', note: '金沙江' },
    { lon: 104.4, lat: 28.6, name: '向家坝', note: '金沙江' },
    { lon: 111.0, lat: 30.8, name: '三峡', note: '长江' },
    { lon: 111.3, lat: 30.72, name: '葛洲坝', note: '长江' },
    { lon: 101.1, lat: 36.1, name: '龙羊峡', note: '黄河' },
    { lon: 101.35, lat: 36.05, name: '拉西瓦', note: '黄河' },
    { lon: 102.05, lat: 36.1, name: '李家峡', note: '黄河' },
    { lon: 103.3, lat: 35.9, name: '刘家峡', note: '黄河' },
    { lon: 101.55, lat: 28.2, name: '锦屏', note: '雅砻江' },
    { lon: 101.75, lat: 26.9, name: '二滩', note: '雅砻江' },
    { lon: 100.05, lat: 24.7, name: '小湾', note: '澜沧江' },
    { lon: 100.4, lat: 22.7, name: '糯扎渡', note: '澜沧江' }
  ]
}))

registerTeachingLayer(definePointSetLayer({
  id: 'china-resource-cities',
  name: '资源型城市案例',
  category: 'human',
  description: '资源枯竭型城市的典型代表',
  color: '#fa8c16',
  flyTo: { longitude: 112, latitude: 36, height: 5500000 },
  points: [
    { lon: 125.0, lat: 46.6, name: '大庆', note: '石油' },
    { lon: 98.5, lat: 40.3, name: '玉门', note: '石油' },
    { lon: 121.7, lat: 42.0, name: '阜新', note: '煤炭' },
    { lon: 123.9, lat: 41.9, name: '抚顺', note: '煤炭' },
    { lon: 113.2, lat: 35.2, name: '焦作', note: '煤炭' },
    { lon: 109.0, lat: 35.1, name: '铜川', note: '煤炭' },
    { lon: 106.4, lat: 39.0, name: '石嘴山', note: '煤炭' },
    { lon: 115.0, lat: 30.2, name: '黄石', note: '铁、煤' },
    { lon: 104.2, lat: 36.5, name: '白银', note: '铜' },
    { lon: 103.2, lat: 23.4, name: '个旧', note: '锡' },
    { lon: 101.7, lat: 26.6, name: '攀枝花', note: '钒钛' },
    { lon: 128.9, lat: 47.7, name: '伊春', note: '森林' }
  ]
}))
