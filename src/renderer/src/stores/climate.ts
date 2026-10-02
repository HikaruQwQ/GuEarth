import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { summerFactor, winterFactor } from '@renderer/thematic/windField'

export type ThematicLayerId = 'wind-particles' | 'pressure-belts' | 'koppen-zones' | 'frontal-cyclone' | 'rain-belt' | 'summer-monsoon' | 'winter-monsoon' | 'ocean-currents' | 'climate-zones' | 'coriolis-demo' | 'plate-tectonics'

export interface ThematicLayerMeta {
  id: ThematicLayerId
  name: string
  description: string
}

export const thematicLayerCatalog: ThematicLayerMeta[] = [
  { id: 'wind-particles', name: '季风粒子动画', description: '示意风场随月份演变' },
  { id: 'pressure-belts', name: '气压带与风带', description: '七压六风及其季节移动（1月/7月）' },
  { id: 'koppen-zones', name: '世界气候类型', description: '全球气候类型分布示意（可点击查看成因）' },
  { id: 'frontal-cyclone', name: '锋面气旋', description: '北半球温带气旋结构示意' },
  { id: 'rain-belt', name: '降水雨带', description: '东部雨带随月份推进' },
  { id: 'summer-monsoon', name: '夏季风风向', description: '偏南气流路径' },
  { id: 'winter-monsoon', name: '冬季风风向', description: '偏北气流路径' },
  { id: 'ocean-currents', name: '世界洋流', description: '暖流与寒流分布' },
  { id: 'climate-zones', name: '中国气候区', description: '五大气候区示意' },
  { id: 'coriolis-demo', name: '地转偏向力演示', description: '水平运动物体的偏转轨迹（北右南左）' },
  { id: 'plate-tectonics', name: '板块运动与地震火山', description: '三大类板块边界、典型火山与近期地震（可点击查看成因）' }
]

const MONTHS_PER_SECOND = 0.5
const MONTH_MAX = 13

export const useClimateStore = defineStore('climate', () => {
  const month = ref(7)
  const isPlaying = ref(false)
  const overlays = ref<Record<ThematicLayerId, boolean>>({
    'wind-particles': false,
    'pressure-belts': false,
    'koppen-zones': false,
    'frontal-cyclone': false,
    'rain-belt': false,
    'summer-monsoon': false,
    'winter-monsoon': false,
    'ocean-currents': false,
    'climate-zones': false,
    'coriolis-demo': false,
    'plate-tectonics': false
  })

  const summerStrength = computed(() => summerFactor(month.value))
  const winterStrength = computed(() => winterFactor(month.value))
  const hasActiveOverlay = computed(() => Object.values(overlays.value).some(Boolean))

  function setOverlay(id: ThematicLayerId, enabled: boolean): void {
    overlays.value[id] = enabled
  }

  function setMonth(value: number): void {
    month.value = Math.min(12, Math.max(1, Math.round(value)))
  }

  function togglePlaying(): void {
    isPlaying.value = !isPlaying.value
  }

  function advance(dtSeconds: number): void {
    if (!isPlaying.value) return
    const next = month.value + dtSeconds * MONTHS_PER_SECOND
    month.value = next >= MONTH_MAX ? next - 12 : next
  }

  return { month, isPlaying, overlays, summerStrength, winterStrength, hasActiveOverlay, setOverlay, setMonth, togglePlaying, advance }
})
