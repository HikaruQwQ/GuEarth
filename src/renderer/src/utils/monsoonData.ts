export interface CurrentDefinition {
  name: string
  warm: boolean
  labelAt: [number, number]
  path: Array<[number, number]>
}

export const OCEAN_CURRENTS: CurrentDefinition[] = [
  { name: '黑潮', warm: true, labelAt: [127, 25], path: [[122, 21], [125, 24], [129, 28], [133, 32], [138, 35], [142, 37]] },
  { name: '北太平洋暖流', warm: true, labelAt: [-175, 41], path: [[142, 37], [160, 40], [-175, 41], [-155, 42], [-140, 42]] },
  { name: '加利福尼亚寒流', warm: false, labelAt: [-127, 32], path: [[-140, 42], [-135, 38], [-130, 34], [-125, 28], [-121, 23]] },
  { name: '北赤道暖流', warm: true, labelAt: [-160, 14], path: [[-105, 12], [-130, 13], [-160, 14], [-190, 15], [-220, 16]] },
  { name: '千岛寒流', warm: false, labelAt: [150, 44], path: [[158, 52], [152, 47], [147, 42], [143, 38], [140, 35]] },
  { name: '湾流', warm: true, labelAt: [-73, 33], path: [[-80, 25], [-79, 29], [-75, 33], [-68, 37], [-60, 40], [-50, 43]] },
  { name: '北大西洋暖流', warm: true, labelAt: [-20, 55], path: [[-50, 43], [-40, 48], [-30, 52], [-20, 56], [-8, 58], [0, 60]] },
  { name: '加那利寒流', warm: false, labelAt: [-15, 28], path: [[-10, 45], [-13, 40], [-16, 34], [-18, 28], [-19, 22]] },
  { name: '北赤道暖流(大西洋)', warm: true, labelAt: [-45, 13], path: [[-20, 12], [-35, 13], [-50, 14], [-60, 15]] },
  { name: '巴西暖流', warm: true, labelAt: [-38, -22], path: [[-35, -8], [-38, -14], [-40, -20], [-42, -27], [-46, -32]] },
  { name: '本格拉寒流', warm: false, labelAt: [10, -22], path: [[18, -32], [14, -27], [11, -21], [9, -15], [8, -8]] },
  { name: '秘鲁寒流', warm: false, labelAt: [-82, -20], path: [[-72, -40], [-76, -33], [-79, -25], [-81, -16], [-82, -6], [-82, 2]] },
  { name: '南赤道暖流', warm: true, labelAt: [-120, -8], path: [[-85, -6], [-105, -7], [-125, -8], [-150, -9], [-175, -10]] },
  { name: '西风漂流', warm: false, labelAt: [140, -52], path: [[-70, -52], [-30, -52], [10, -50], [50, -50], [90, -50], [130, -52], [170, -54], [-160, -54]] },
  { name: '厄加勒斯暖流', warm: true, labelAt: [34, -30], path: [[38, -20], [35, -26], [31, -32], [26, -38], [20, -42]] },
  { name: '东澳大利亚暖流', warm: true, labelAt: [154, -28], path: [[152, -18], [154, -24], [155, -30], [152, -36], [148, -41]] },
  { name: '莫桑比克暖流', warm: true, labelAt: [41, -18], path: [[40, -10], [41, -16], [42, -22], [43, -26]] },
  { name: '拉布拉多寒流', warm: false, labelAt: [-55, 52], path: [[-60, 62], [-56, 56], [-52, 50], [-50, 45], [-52, 42]] },
  { name: '阿拉斯加暖流', warm: true, labelAt: [-152, 55], path: [[-140, 48], [-148, 53], [-156, 57], [-162, 58]] },
  { name: '东格陵兰寒流', warm: false, labelAt: [-30, 64], path: [[-12, 76], [-20, 70], [-30, 64], [-40, 56], [-46, 50]] },
  { name: '西澳大利亚寒流', warm: false, labelAt: [110, -28], path: [[112, -38], [115, -32], [114, -24], [113, -16]] }
]

export const INDIAN_SUMMER_CURRENTS: CurrentDefinition[] = [
  { name: '季风洋流', warm: true, labelAt: [72, 7], path: [[50, 4], [64, 6], [80, 6], [92, 4]] },
  { name: '索马里寒流', warm: false, labelAt: [48, 8], path: [[40, -2], [44, 3], [48, 9], [53, 12]] }
]

export const INDIAN_WINTER_CURRENTS: CurrentDefinition[] = [
  { name: '季风洋流', warm: false, labelAt: [76, 4], path: [[93, 2], [78, 4], [64, 3], [51, 2]] },
  { name: '索马里暖流', warm: true, labelAt: [48, 0], path: [[53, 11], [48, 6], [44, 1], [41, -3]] }
]

export interface WindArrow {
  id: string
  path: Array<[number, number]>
}

export const SUMMER_MONSOON_ARROWS: WindArrow[] = [
  { id: 'se-main', path: [[128, 18], [120, 26], [112, 33]] },
  { id: 'se-south', path: [[118, 12], [110, 20], [104, 26]] },
  { id: 'sw-india', path: [[85, 5], [92, 15], [98, 25], [102, 32]] },
  { id: 'sw-bay', path: [[92, 12], [98, 20], [104, 27]] }
]

export const WINTER_MONSOON_ARROWS: WindArrow[] = [
  { id: 'nw-main', path: [[95, 52], [105, 42], [113, 32], [118, 24]] },
  { id: 'nw-east', path: [[122, 50], [124, 40], [124, 30], [122, 22]] },
  { id: 'nw-west', path: [[80, 48], [88, 40], [94, 32]] }
]

export interface ClimateZone {
  name: string
  color: string
  ring: Array<[number, number]>
  labelAt: [number, number]
}

export const CHINA_CLIMATE_ZONES: ClimateZone[] = [
  {
    name: '热带季风气候',
    color: '#fa8c16',
    labelAt: [109, 20],
    ring: [[97, 22.5], [102, 21], [106, 19.5], [110, 18.2], [112, 19.5], [110.5, 21.5], [108, 22.8], [104, 23.8], [100, 24], [97, 24]]
  },
  {
    name: '亚热带季风气候',
    color: '#52c41a',
    labelAt: [112, 28],
    ring: [[98, 24], [104, 23.5], [110, 22.5], [116, 22.5], [121, 24.5], [122.5, 28], [122, 31.5], [118, 33.5], [112, 34], [106, 34.5], [102, 33], [98.5, 30], [98, 27]]
  },
  {
    name: '温带季风气候',
    color: '#2f54eb',
    labelAt: [120, 40],
    ring: [[106, 34.5], [112, 34], [118, 33.5], [122, 31.8], [124.5, 35], [127, 39], [131, 43], [134.5, 47.5], [133, 51], [127, 52.5], [121, 50.5], [117, 46], [113, 42], [108, 38], [105.5, 36]]
  },
  {
    name: '温带大陆性气候',
    color: '#faad14',
    labelAt: [90, 42],
    ring: [[74, 40], [80, 37], [88, 36.5], [96, 37.5], [104, 39], [106, 42], [107, 45.5], [104, 49], [97, 50.5], [90, 49.5], [83, 48.5], [77, 46.5], [74.5, 43.5]]
  },
  {
    name: '高原山地气候',
    color: '#722ed1',
    labelAt: [88, 32.5],
    ring: [[75, 34.5], [80, 33], [85, 31.5], [90, 30], [96, 29], [100, 29.5], [103, 31.5], [101.5, 34], [98, 36], [93, 37.5], [87, 38.5], [81, 38.5], [76.5, 37]]
  }
]

export const MONSOON_BOX = { west: 58, east: 150, south: -12, north: 60 }
