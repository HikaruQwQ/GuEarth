import { registerTeachingLayer } from '../registry'
import { defineRouteLayer } from '../renderers'
import { TYPHOON_EVENTS, categoryForWind } from '@renderer/utils/typhoonData'

registerTeachingLayer(defineRouteLayer({
  id: 'typhoon-tracks',
  name: '历史台风路径',
  category: 'nature',
  description: '山竹 · 海燕 · 利奇马 · 杜苏芮',
  flyTo: { longitude: 125, latitude: 20, height: 7000000 },
  routes: TYPHOON_EVENTS.map((event) => ({
    name: `${event.name}（${event.year}）`,
    color: '#d4380d',
    path: event.points.map((point) => [point.lon, point.lat] as [number, number]),
    labelAt: [event.points[0].lon + 3, event.points[0].lat + 3] as [number, number],
    note: `${event.summary}；最强 ${categoryForWind(Math.max(...event.points.map((point) => point.windMs)))}`
  }))
}))
