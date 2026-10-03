<script setup lang="ts">
import { computed } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import LineChart, { type ChartSeries } from '@renderer/components/charts/LineChart.vue'

const emit = defineEmits<{ close: [] }>()

const temperatureStops: Array<[number, number]> = [
  [-60, 2.5], [-50, 4.5], [-40, 9], [-30, 16], [-20, 24], [-10, 27.5], [0, 28.5], [10, 28.3], [20, 26.5], [30, 23], [40, 19], [50, 13], [60, 8]
]

const salinityStops: Array<[number, number]> = [
  [-60, 33.6], [-50, 33.9], [-40, 34.4], [-30, 35.6], [-23, 36.8], [-15, 36.2], [0, 34.6], [12, 35.6], [25, 36.9], [32, 36.4], [40, 35.2], [50, 34.4], [60, 33.8]
]

const temperatureSeries = computed<ChartSeries[]>(() => [{ name: '表层海水温度', color: '#fa541c', points: temperatureStops }])
const salinitySeries = computed<ChartSeries[]>(() => [{ name: '表层海水盐度', color: '#1677ff', points: salinityStops, markY: [35] }])

const facts = [
  '海水温度：自赤道（约 28~29℃）向两极递减，副热带海域因蒸发强、降水少，温度分布受洋流影响明显——暖流增温、寒流降温。',
  '海水盐度：从副热带海域（约 36.5‰）分别向赤道（降水多，约 34.5‰）和高纬（融冰稀释，约 33.5‰）递低，呈“马鞍形”双峰曲线。',
  '世界盐度最高：红海（约 41‰，蒸发极强、几乎无淡水注入）；最低：波罗的海（约 10‰ 以内，纬度高蒸发弱、河流注入多）。',
  '影响海水温度与盐度的主要因素：纬度（辐射）、降水量与蒸发量、洋流、河川径流与结融冰。'
]
</script>

<template>
  <div class="ocean-panel" role="group" aria-label="海水温度与盐度">
    <div class="panel-header">
      <span class="panel-title">海水温度与盐度</span>
      <a-button type="text" size="small" aria-label="关闭海水温度与盐度" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </div>
    <div class="chart-title">表层海水温度随纬度分布</div>
    <LineChart :series="temperatureSeries" :x-min="-60" :x-max="60" x-name="纬度" y-name="温度(℃)" :y-min="0" :y-max="32" :height="150" />
    <div class="chart-title">表层海水盐度随纬度分布</div>
    <LineChart :series="salinitySeries" :x-min="-60" :x-max="60" x-name="纬度" y-name="盐度(‰)" :y-min="33" :y-max="38" :height="150" />
    <div v-for="fact in facts" :key="fact" class="fact">· {{ fact }}</div>
  </div>
</template>

<style scoped>
.ocean-panel {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 380px;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
  padding: 12px 16px 16px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  box-shadow: var(--ant-box-shadow-secondary, 0 4px 12px rgba(0, 0, 0, 0.08));
  z-index: 10;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title {
  margin-right: auto;
  color: rgba(0, 0, 0, 0.88);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.chart-title {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.fact {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 19px;
}
</style>
