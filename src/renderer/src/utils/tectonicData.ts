export interface PlateBoundary {
  name: string
  kind: 'convergent' | 'divergent'
  path: Array<[number, number]>
}

export interface VolcanoPoint {
  name: string
  lon: number
  lat: number
}

export interface EarthquakePoint {
  name: string
  year: number
  magnitude: number
  lon: number
  lat: number
}

export const PLATE_BOUNDARIES: PlateBoundary[] = [
  { name: '千岛—日本海沟', kind: 'convergent', path: [[158, 54], [152, 46], [145, 41], [142, 36]] },
  { name: '马里亚纳海沟', kind: 'convergent', path: [[143, 26], [146, 18], [145, 11], [140, 6]] },
  { name: '汤加—克马德克海沟', kind: 'convergent', path: [[-174, -15], [-177, -24], [-179, -33], [178, -40]] },
  { name: '秘鲁—智利海沟', kind: 'convergent', path: [[-70, -12], [-72, -22], [-74, -33], [-76, -42]] },
  { name: '阿留申海沟', kind: 'convergent', path: [[165, 52], [178, 53], [-179, 52], [-170, 53]] },
  { name: '卡斯凯迪亚俯冲带', kind: 'convergent', path: [[-125, 41], [-128, 45], [-131, 49]] },
  { name: '喜马拉雅碰撞带', kind: 'convergent', path: [[72, 36], [80, 32], [88, 28], [96, 26], [100, 24]] },
  { name: '阿尔卑斯造山带', kind: 'convergent', path: [[-5, 43], [8, 44], [16, 44], [24, 41]] },
  { name: '扎格罗斯碰撞带', kind: 'convergent', path: [[46, 34], [52, 30], [58, 27]] },
  { name: '苏门答腊—爪哇海沟', kind: 'convergent', path: [[95, 14], [97, 4], [100, -3], [106, -8], [114, -10]] },
  { name: '大西洋中脊', kind: 'divergent', path: [[-18, 66], [-26, 56], [-30, 44], [-24, 30], [-18, 12], [-15, -5], [-14, -22], [-18, -40], [-22, -52]] },
  { name: '东太平洋海隆', kind: 'divergent', path: [[-112, -42], [-104, -28], [-98, -14], [-102, 2], [-108, 12]] },
  { name: '印度洋中脊', kind: 'divergent', path: [[58, -8], [66, -20], [70, -32], [78, -44]] },
  { name: '红海裂谷', kind: 'divergent', path: [[34, 28], [38, 20], [42, 13], [44, 11]] },
  { name: '东非大裂谷', kind: 'divergent', path: [[36, 12], [36, 2], [34, -6], [33, -14]] },
  { name: '环南极洲西风漂流脊', kind: 'divergent', path: [[-60, -54], [-20, -54], [20, -52], [60, -50], [100, -50], [140, -54], [170, -58]] }
]

export const MAJOR_VOLCANOES: VolcanoPoint[] = [
  { name: '富士山', lon: 138.7, lat: 35.4 },
  { name: '克柳切夫火山', lon: 160.6, lat: 56.1 },
  { name: '维苏威火山', lon: 14.4, lat: 40.8 },
  { name: '埃特纳火山', lon: 15.0, lat: 37.75 },
  { name: '圣海伦斯火山', lon: -122.2, lat: 46.2 },
  { name: '基拉韦厄火山', lon: -155.3, lat: 19.4 },
  { name: '波波卡特佩特尔火山', lon: -98.6, lat: 19.0 },
  { name: '科托帕希火山', lon: -78.4, lat: -0.7 },
  { name: '坦博拉火山', lon: 118.0, lat: -8.25 },
  { name: '喀拉喀托火山', lon: 105.4, lat: -6.1 },
  { name: '赫克拉火山', lon: -19.7, lat: 63.98 },
  { name: '埃里伯斯火山', lon: 167.1, lat: -77.5 }
]

export const NOTABLE_EARTHQUAKES: EarthquakePoint[] = [
  { name: '海城—唐山', year: 1976, magnitude: 7.8, lon: 118.2, lat: 39.6 },
  { name: '汶川', year: 2008, magnitude: 8.0, lon: 103.4, lat: 31.0 },
  { name: '台湾集集', year: 1999, magnitude: 7.7, lon: 120.8, lat: 23.9 },
  { name: '阪神', year: 1995, magnitude: 6.9, lon: 135.0, lat: 34.6 },
  { name: '东日本大地震', year: 2011, magnitude: 9.1, lon: 142.4, lat: 38.3 },
  { name: '苏门答腊—安达曼', year: 2004, magnitude: 9.1, lon: 95.9, lat: 3.3 },
  { name: '尼泊尔廓尔喀', year: 2015, magnitude: 7.8, lon: 84.7, lat: 28.2 },
  { name: '土耳其—叙利亚', year: 2023, magnitude: 7.8, lon: 37.0, lat: 37.2 },
  { name: '瓦尔迪维亚', year: 1960, magnitude: 9.5, lon: -73.4, lat: -38.1 },
  { name: '智利马乌莱', year: 2010, magnitude: 8.8, lon: -72.7, lat: -36.1 },
  { name: '墨西哥城', year: 1985, magnitude: 8.0, lon: -102.5, lat: 18.2 },
  { name: '海地', year: 2010, magnitude: 7.0, lon: -72.5, lat: 18.5 },
  { name: '阿拉斯加威廉王子湾', year: 1964, magnitude: 9.2, lon: -147.3, lat: 61.0 },
  { name: '堪察加', year: 1952, magnitude: 9.0, lon: 161.0, lat: 52.8 }
]

export const BOUNDARY_COLORS: Record<PlateBoundary['kind'], string> = {
  convergent: '#f5222d',
  divergent: '#52c41a'
}

export const BOUNDARY_KIND_LABELS: Record<PlateBoundary['kind'], string> = {
  convergent: '消亡边界（海沟 · 造山带）',
  divergent: '生长边界（洋中脊 · 裂谷）'
}

export function earthquakePixelSize(magnitude: number): number {
  return 7 + Math.max(0, magnitude - 6.5) * 7
}

export function earthquakeLabel(point: EarthquakePoint): string {
  return `${point.name} ${point.year}年 M${point.magnitude.toFixed(1)}`
}
