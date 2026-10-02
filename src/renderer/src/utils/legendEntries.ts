import { computed, type ComputedRef } from 'vue'
import { useTectonicStore } from '@renderer/stores/tectonic'
import { useMonsoonStore } from '@renderer/stores/monsoon'
import { useSolarStore } from '@renderer/stores/solar'
import { useTeachingStore } from '@renderer/stores/teaching'

export type LegendShape = 'line' | 'dash' | 'dot' | 'arrow' | 'fill'

export interface LegendItem {
  color: string
  label: string
  shape: LegendShape
}

export interface LegendSection {
  id: string
  title: string
  items: LegendItem[]
}

export function useLegendSections(): ComputedRef<LegendSection[]> {
  const tectonic = useTectonicStore()
  const monsoon = useMonsoonStore()
  const solar = useSolarStore()
  const teaching = useTeachingStore()
  return computed(() => {
    const sections: LegendSection[] = []
    if (tectonic.panelOpen) {
      const items: LegendItem[] = []
      if (tectonic.showBoundaries) {
        items.push({ color: '#f5222d', label: '消亡边界', shape: 'line' })
        items.push({ color: '#52c41a', label: '生长边界', shape: 'line' })
      }
      if (tectonic.showVolcanoes) items.push({ color: '#fa8c16', label: '火山', shape: 'dot' })
      if (tectonic.showQuakes) items.push({ color: '#d4380d', label: '地震', shape: 'dot' })
      if (items.length > 0) sections.push({ id: 'tectonic', title: '板块构造', items })
    }
    if (monsoon.panelOpen) {
      const items: LegendItem[] = []
      if (monsoon.showSummerWind) items.push({ color: '#fa8c16', label: '夏季风', shape: 'arrow' })
      if (monsoon.showWinterWind) items.push({ color: '#2f54eb', label: '冬季风', shape: 'arrow' })
      if (monsoon.showCurrents) {
        items.push({ color: '#f5222d', label: '暖流', shape: 'line' })
        items.push({ color: '#2f54eb', label: '寒流', shape: 'line' })
      }
      if (monsoon.showRainband) items.push({ color: '#1677ff', label: '雨带', shape: 'fill' })
      if (monsoon.showClimateZones) items.push({ color: '#7cb305', label: '气候区', shape: 'fill' })
      if (items.length > 0) sections.push({ id: 'monsoon', title: '季风 · 洋流', items })
    }
    if (solar.panelOpen) {
      const items: LegendItem[] = []
      if (solar.showTerminator) items.push({ color: '#595959', label: '晨昏线', shape: 'dash' })
      if (solar.showSubsolar) items.push({ color: '#faad14', label: '太阳直射点', shape: 'dot' })
      if (items.length > 0) sections.push({ id: 'solar', title: '昼夜光照', items })
    }
    return [...sections, ...teaching.legendSections]
  })
}
