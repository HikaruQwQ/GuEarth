<script setup lang="ts">
import { computed } from 'vue'
import { CaretRightOutlined, PauseOutlined } from '@ant-design/icons-vue'
import { useMonsoonStore } from '@renderer/stores/monsoon'

const store = useMonsoonStore()

const marks: Record<number, string> = { 1: '1月', 4: '4月', 7: '7月', 10: '10月', 12: '12月' }

const toggles = computed(() => [
  { key: 'particles' as const, label: '季风粒子', value: store.showParticles },
  { key: 'rainband' as const, label: '降水雨带', value: store.showRainband },
  { key: 'summerWind' as const, label: '夏季风风向', value: store.showSummerWind },
  { key: 'winterWind' as const, label: '冬季风风向', value: store.showWinterWind },
  { key: 'currents' as const, label: '世界洋流', value: store.showCurrents },
  { key: 'monsoonCurrents' as const, label: '北印度洋洋流', value: store.showMonsoonCurrents },
  { key: 'pressureBelts' as const, label: '气压带', value: store.showPressureBelts },
  { key: 'windBelts' as const, label: '风带', value: store.showWindBelts },
  { key: 'climateZones' as const, label: '中国气候区', value: store.showClimateZones },
  { key: 'climateRegions' as const, label: '世界气候区', value: store.showClimateRegions }
])

const seasonHint = computed(() => {
  if (store.month >= 5 && store.month <= 9) return '夏季：风从海洋吹向陆地（东南季风 · 西南季风）'
  if (store.month <= 2 || store.month >= 11) return '冬季：风从陆地吹向海洋（西北季风）'
  return '过渡季节：冬夏季风转换期'
})
</script>

<template>
  <div class="monsoon-pane">
    <div class="timeline-row">
      <a-button type="primary" size="small" :aria-label="store.playing ? '暂停时间轴' : '播放时间轴'" @click="store.togglePlay()">
        <CaretRightOutlined v-if="!store.playing" /><PauseOutlined v-else />
      </a-button>
      <a-slider :value="store.month" :min="1" :max="12" :step="1" :marks="marks" :tooltip="{ formatter: (value: number) => `${value}月` }" class="month-slider" aria-label="月份时间轴" @change="(value: number) => store.setMonth(value)" />
      <span class="month-readout">{{ store.month }}月</span>
    </div>
    <p class="season-hint">{{ seasonHint }}</p>
    <div class="toggle-grid">
      <label v-for="toggle in toggles" :key="toggle.key" class="toggle-item">
        <span>{{ toggle.label }}</span>
        <a-switch size="small" :checked="toggle.value" :aria-label="toggle.label" @change="(value: boolean) => store.setShow(toggle.key, value)" />
      </label>
    </div>
  </div>
</template>

<style scoped>
.timeline-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.month-slider {
  flex: 1;
  margin: 0 8px 18px 8px;
}

.month-readout {
  flex: none;
  width: 36px;
  text-align: center;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.88);
}

.season-hint {
  margin: 2px 0 8px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}

.toggle-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px 16px;
}

.toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
  line-height: 22px;
  cursor: pointer;
}
</style>
