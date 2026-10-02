export interface MonsoonArrow {
  from: [number, number]
  to: [number, number]
  label: string
}

export const summerMonsoonArrows: MonsoonArrow[] = [
  { from: [44, -10], to: [52, 3], label: '越赤道气流' },
  { from: [56, 7], to: [68, 18], label: '西南季风' },
  { from: [85, 5], to: [88, 19], label: '西南季风' },
  { from: [97, 8], to: [101, 22], label: '西南季风' },
  { from: [131, 15], to: [121, 25], label: '东南季风' },
  { from: [128, 22], to: [122, 31], label: '东南季风' },
  { from: [108, 2], to: [112, 12], label: '西南季风' }
]

export const winterMonsoonArrows: MonsoonArrow[] = [
  { from: [96, 58], to: [103, 45], label: '西北季风' },
  { from: [105, 52], to: [113, 38], label: '西北季风' },
  { from: [110, 42], to: [118, 28], label: '西北季风' },
  { from: [117, 23], to: [111, 10], label: '东北季风' },
  { from: [98, 25], to: [88, 12], label: '东北季风' }
]
