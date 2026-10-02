export type TyphoonCategory = '热带低压' | '热带风暴' | '强热带风暴' | '台风' | '强台风' | '超强台风'

export interface TyphoonTrackPoint {
  date: string
  lon: number
  lat: number
  windMs: number
}

export interface TyphoonEvent {
  id: string
  name: string
  year: number
  summary: string
  points: TyphoonTrackPoint[]
}

export function categoryForWind(windMs: number): TyphoonCategory {
  if (windMs >= 51) return '超强台风'
  if (windMs >= 41.5) return '强台风'
  if (windMs >= 32.7) return '台风'
  if (windMs >= 24.5) return '强热带风暴'
  if (windMs >= 17.2) return '热带风暴'
  return '热带低压'
}

export const TYPHOON_EVENTS: TyphoonEvent[] = [
  {
    id: 'mangkhut-2018',
    name: '山竹',
    year: 2018,
    summary: '2018 年 9 月超强台风，穿过菲律宾吕宋岛后登陆广东台山',
    points: [
      { date: '09-07', lon: 160.0, lat: 10.0, windMs: 20 },
      { date: '09-09', lon: 149.0, lat: 14.3, windMs: 45 },
      { date: '09-11', lon: 137.0, lat: 16.0, windMs: 58 },
      { date: '09-13', lon: 127.0, lat: 17.0, windMs: 55 },
      { date: '09-15', lon: 121.0, lat: 17.5, windMs: 45 },
      { date: '09-16', lon: 116.0, lat: 20.5, windMs: 42 },
      { date: '09-16', lon: 112.8, lat: 22.3, windMs: 35 },
      { date: '09-17', lon: 109.5, lat: 23.0, windMs: 23 },
      { date: '09-18', lon: 105.0, lat: 22.0, windMs: 14 }
    ]
  },
  {
    id: 'haiyan-2013',
    name: '海燕',
    year: 2013,
    summary: '2013 年 11 月登陆菲律宾的极端超强台风',
    points: [
      { date: '11-04', lon: 152.0, lat: 6.0, windMs: 20 },
      { date: '11-05', lon: 146.5, lat: 8.0, windMs: 40 },
      { date: '11-06', lon: 139.5, lat: 10.0, windMs: 55 },
      { date: '11-07', lon: 130.0, lat: 11.0, windMs: 65 },
      { date: '11-08', lon: 125.0, lat: 11.2, windMs: 65 },
      { date: '11-09', lon: 120.0, lat: 12.5, windMs: 50 },
      { date: '11-10', lon: 112.0, lat: 15.5, windMs: 33 },
      { date: '11-11', lon: 107.0, lat: 16.5, windMs: 15 }
    ]
  },
  {
    id: 'lekima-2019',
    name: '利奇马',
    year: 2019,
    summary: '2019 年 8 月登陆浙江温岭的强台风，北上影响山东',
    points: [
      { date: '08-04', lon: 131.0, lat: 19.5, windMs: 20 },
      { date: '08-06', lon: 128.0, lat: 21.8, windMs: 33 },
      { date: '08-07', lon: 125.0, lat: 24.0, windMs: 45 },
      { date: '08-08', lon: 123.0, lat: 26.5, windMs: 52 },
      { date: '08-09', lon: 121.6, lat: 28.3, windMs: 52 },
      { date: '08-10', lon: 119.5, lat: 30.2, windMs: 30 },
      { date: '08-11', lon: 118.0, lat: 33.0, windMs: 23 },
      { date: '08-12', lon: 118.4, lat: 36.5, windMs: 18 },
      { date: '08-13', lon: 118.6, lat: 38.8, windMs: 14 }
    ]
  },
  {
    id: 'doksuri-2023',
    name: '杜苏芮',
    year: 2023,
    summary: '2023 年 7 月登陆福建晋江，残余环流北上引发华北极端暴雨',
    points: [
      { date: '07-21', lon: 135.0, lat: 13.0, windMs: 20 },
      { date: '07-23', lon: 128.0, lat: 15.0, windMs: 35 },
      { date: '07-24', lon: 125.0, lat: 17.2, windMs: 45 },
      { date: '07-25', lon: 121.0, lat: 19.5, windMs: 50 },
      { date: '07-26', lon: 119.2, lat: 21.5, windMs: 52 },
      { date: '07-28', lon: 118.6, lat: 24.6, windMs: 45 },
      { date: '07-29', lon: 116.2, lat: 27.5, windMs: 25 },
      { date: '07-30', lon: 114.5, lat: 32.5, windMs: 16 },
      { date: '07-31', lon: 114.6, lat: 36.0, windMs: 12 }
    ]
  }
]
