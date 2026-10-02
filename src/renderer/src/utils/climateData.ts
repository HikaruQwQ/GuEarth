export interface ClimateRegion {
  name: string
  koppen: string
  color: string
  labelAt: [number, number]
  ring: Array<[number, number]>
}

function antarcticaRing(): Array<[number, number]> {
  const ring: Array<[number, number]> = []
  for (let lon = -180; lon <= 180; lon += 20) ring.push([lon, -66])
  for (let lon = 180; lon >= -180; lon -= 20) ring.push([lon, -90])
  return ring
}

export const CLIMATE_REGIONS: ClimateRegion[] = [
  { name: '亚马孙热带雨林', koppen: 'Af', color: '#1d8ac8', labelAt: [-62, -3], ring: [[-75, 0], [-70, 5], [-60, 6], [-52, 4], [-48, 0], [-50, -6], [-58, -12], [-68, -12], [-74, -8]] },
  { name: '刚果盆地热带雨林', koppen: 'Af', color: '#1d8ac8', labelAt: [20, -3], ring: [[9, 2], [18, 4], [27, 2], [30, -4], [27, -10], [19, -11], [12, -6], [9, -2]] },
  { name: '马来群岛热带雨林', koppen: 'Af', color: '#1d8ac8', labelAt: [114, -2], ring: [[96, 6], [104, 3], [114, 1], [124, 1], [134, -2], [138, -6], [132, -9], [120, -9], [110, -8], [100, -4], [95, 2]] },
  { name: '非洲热带草原', koppen: 'Aw', color: '#faa519', labelAt: [12, 9], ring: [[-15, 12], [-5, 13], [5, 12], [15, 11], [25, 10], [32, 10], [34, 6], [26, 5], [15, 6], [5, 7], [-8, 6], [-14, 8]] },
  { name: '东非热带草原', koppen: 'Aw', color: '#faa519', labelAt: [36, -3], ring: [[30, 2], [36, 4], [42, 2], [44, -4], [40, -8], [34, -8], [30, -4]] },
  { name: '巴西高原热带草原', koppen: 'Aw', color: '#faa519', labelAt: [-50, -16], ring: [[-45, -8], [-40, -12], [-42, -20], [-50, -24], [-56, -20], [-58, -14], [-52, -9]] },
  { name: '澳大利亚北部热带草原', koppen: 'Aw', color: '#faa519', labelAt: [132, -17], ring: [[122, -14], [130, -11], [138, -12], [145, -15], [146, -20], [138, -22], [128, -20], [122, -18]] },
  { name: '撒哈拉沙漠', koppen: 'BWh', color: '#d4380d', labelAt: [8, 23], ring: [[-16, 22], [-10, 28], [0, 30], [12, 30], [24, 30], [32, 28], [34, 20], [28, 14], [18, 15], [8, 16], [-5, 17], [-14, 18]] },
  { name: '阿拉伯沙漠', koppen: 'BWh', color: '#d4380d', labelAt: [46, 20], ring: [[35, 18], [42, 24], [50, 25], [56, 24], [58, 20], [52, 15], [44, 13], [38, 15]] },
  { name: '澳大利亚中西部沙漠', koppen: 'BWh', color: '#d4380d', labelAt: [128, -26], ring: [[114, -22], [122, -20], [132, -19], [140, -22], [141, -30], [134, -32], [124, -33], [116, -30]] },
  { name: '阿塔卡马沙漠', koppen: 'BWk', color: '#d4380d', labelAt: [-72, -22], ring: [[-72, -16], [-70, -20], [-71, -26], [-76, -30], [-78, -24], [-77, -14]] },
  { name: '地中海北岸', koppen: 'Csa', color: '#e6b800', labelAt: [10, 41], ring: [[-6, 38], [-2, 43], [5, 43], [12, 44], [20, 42], [26, 40], [30, 37], [28, 35], [20, 37], [10, 39], [0, 37], [-4, 36]] },
  { name: '地中海南岸', koppen: 'Csa', color: '#e6b800', labelAt: [12, 32], ring: [[-8, 33], [0, 33], [10, 33], [20, 31], [32, 30], [34, 33], [25, 34], [10, 36], [0, 36], [-6, 35]] },
  { name: '美国加利福尼亚地中海气候', koppen: 'Csb', color: '#e6b800', labelAt: [-120, 37], ring: [[-124, 40], [-120, 40], [-117, 34], [-122, 33], [-124, 36]] },
  { name: '智利中部地中海气候', koppen: 'Csb', color: '#e6b800', labelAt: [-72, -34], ring: [[-73, -30], [-70, -33], [-72, -38], [-77, -36], [-76, -31]] },
  { name: '南非开普敦地中海气候', koppen: 'Csb', color: '#e6b800', labelAt: [20, -34], ring: [[18, -33], [22, -33], [25, -34], [22, -36], [18, -35]] },
  { name: '澳大利亚西南地中海气候', koppen: 'Csb', color: '#e6b800', labelAt: [117, -33], ring: [[114, -31], [118, -32], [122, -34], [118, -36], [114, -35]] },
  { name: '东亚亚热带季风气候', koppen: 'Cfa', color: '#52c41a', labelAt: [112, 29], ring: [[100, 26], [110, 25], [118, 24], [122, 28], [124, 32], [120, 34], [112, 33], [104, 32], [100, 30]] },
  { name: '美国东南部亚热带湿润气候', koppen: 'Cfa', color: '#52c41a', labelAt: [-84, 32], ring: [[-82, 26], [-88, 30], [-90, 34], [-84, 36], [-78, 34], [-76, 31], [-80, 27]] },
  { name: '阿根廷潘帕斯草原', koppen: 'Cfa', color: '#52c41a', labelAt: [-60, -34], ring: [[-62, -30], [-56, -30], [-54, -34], [-58, -38], [-64, -36]] },
  { name: '澳大利亚东岸亚热带湿润气候', koppen: 'Cfa', color: '#52c41a', labelAt: [150, -28], ring: [[146, -20], [150, -24], [153, -28], [152, -33], [148, -36], [146, -30]] },
  { name: '西欧温带海洋性气候', koppen: 'Cfb', color: '#13c2c2', labelAt: [-4, 50], ring: [[-10, 43], [-2, 43], [2, 48], [4, 54], [-2, 58], [-8, 58], [-12, 52], [-10, 46]] },
  { name: '北美西海岸温带海洋性气候', koppen: 'Cfb', color: '#13c2c2', labelAt: [-126, 50], ring: [[-128, 42], [-122, 46], [-124, 52], [-130, 56], [-134, 54], [-132, 46]] },
  { name: '新西兰温带海洋性气候', koppen: 'Cfb', color: '#13c2c2', labelAt: [172, -42], ring: [[166, -46], [170, -44], [174, -41], [176, -38], [176, -42], [172, -46]] },
  { name: '东亚温带季风气候', koppen: 'Dwa', color: '#2f54eb', labelAt: [120, 40], ring: [[105, 40], [115, 41], [124, 40], [130, 42], [135, 45], [140, 42], [138, 36], [132, 34], [126, 34], [120, 36], [114, 36], [108, 37]] },
  { name: '中亚温带大陆性气候', koppen: 'BWk', color: '#722ed1', labelAt: [70, 43], ring: [[50, 40], [60, 44], [70, 46], [80, 48], [88, 48], [90, 42], [80, 38], [66, 38], [56, 38]] },
  { name: '蒙古高原温带大陆性气候', koppen: 'Dwb', color: '#722ed1', labelAt: [100, 43], ring: [[78, 46], [90, 48], [102, 46], [112, 44], [116, 40], [104, 38], [92, 40], [82, 42]] },
  { name: '北美中部温带大陆性气候', koppen: 'Dfa', color: '#722ed1', labelAt: [-100, 43], ring: [[-112, 48], [-100, 48], [-92, 46], [-90, 40], [-98, 36], [-106, 38], [-114, 42]] },
  { name: '西伯利亚亚寒带针叶林气候', koppen: 'Dfc', color: '#1d39c4', labelAt: [100, 60], ring: [[60, 58], [75, 60], [90, 62], [105, 64], [120, 66], [135, 66], [145, 62], [140, 56], [125, 56], [110, 54], [95, 54], [80, 54], [68, 54]] },
  { name: '加拿大亚寒带针叶林气候', koppen: 'Dfc', color: '#1d39c4', labelAt: [-100, 54], ring: [[-135, 56], [-120, 58], [-105, 58], [-90, 56], [-78, 54], [-72, 50], [-80, 48], [-95, 50], [-110, 50], [-125, 52]] },
  { name: '北美北部苔原带', koppen: 'ET', color: '#8c8c8c', labelAt: [-100, 68], ring: [[-130, 70], [-110, 72], [-90, 72], [-75, 70], [-70, 66], [-85, 64], [-105, 64], [-120, 66]] },
  { name: '欧亚大陆北部苔原带', koppen: 'ET', color: '#8c8c8c', labelAt: [80, 70], ring: [[30, 68], [45, 68], [60, 66], [75, 66], [90, 68], [105, 70], [120, 70], [135, 70], [140, 72], [120, 74], [100, 74], [80, 72], [60, 72], [45, 72], [32, 70]] },
  { name: '格陵兰冰原', koppen: 'EF', color: '#bfbfbf', labelAt: [-42, 72], ring: [[-58, 62], [-44, 60], [-30, 68], [-25, 76], [-35, 82], [-55, 80], [-68, 76], [-65, 68]] },
  { name: '南极冰原', koppen: 'EF', color: '#bfbfbf', labelAt: [20, -78], ring: antarcticaRing() }
]

export function pointInRing(lon: number, lat: number, ring: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const crosses = yi > lat !== yj > lat
    if (!crosses) continue
    const intersectLon = ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (lon < intersectLon) inside = !inside
  }
  return inside
}

export function climateRegionAt(lon: number, lat: number): ClimateRegion | undefined {
  return CLIMATE_REGIONS.find((region) => pointInRing(lon, lat, region.ring))
}

export function latitudeZoneName(lat: number): string {
  const abs = Math.abs(lat)
  if (abs <= 10) return '赤道多雨地带'
  if (abs <= 20) return '热带（信风带）'
  if (abs <= 30) return '副热带（副热带高压带）'
  if (abs <= 40) return '暖温带（西风带南缘）'
  if (abs <= 60) return '温带（盛行西风带）'
  if (abs <= 70) return '亚寒带（副极地低压带）'
  return '寒带（极地高压带）'
}
