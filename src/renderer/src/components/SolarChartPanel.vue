<script setup lang="ts">
import { computed, ref } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { useSolarStore } from '@renderer/stores/solar'
import { dayLength, declinationForDate, monthStartDayOfYear, noonAltitudeDeg, solarDeclinationDeg } from '@renderer/thematic/solarMath'
import LineChart, { type ChartSeries } from '@renderer/components/charts/LineChart.vue'

const emit = defineEmits<{ close: [] }>()

const store = useSolarStore()
const mode = ref<'latitude' | 'date'>('latitude')
const latitude = ref(40)

const DAY_LENGTH_COLOR = '#1677ff'
const ALTITUDE_COLOR = '#fa8c16'

const monthStarts = monthStartDayOfYear()

const declination = computed(() => declinationForDate(store.parts.month, store.parts.day))
const declinationText = computed(() => `${Math.abs(declination.value).toFixed(1)}°${declination.value >= 0 ? 'N' : 'S'}`)

function latLabel(value: number): string {
  return `${Math.abs(value)}°${value > 0 ? 'N' : value < 0 ? 'S' : ''}`
}

const latitudeFormatter = (value: number) => (value === 0 ? '0°' : `${Math.abs(value)}°${value > 0 ? 'N' : 'S'}`)

const dateFormatter = (value: number) => {
  const index = monthStarts.findIndex((start, i) => value >= start && value < (monthStarts[i + 1] ?? 366))
  return index >= 0 ? `${index + 1}月` : ''
}

const dayLengthSeries = computed<ChartSeries[]>(() => {
  if (mode.value === 'latitude') {
    const points: Array<[number, number]> = []
    for (let lat = -90; lat <= 90; lat += 2) points.push([lat, dayLength(lat, declination.value).hours])
    return [{ name: '昼长', color: DAY_LENGTH_COLOR, points, markY: [12] }]
  }
  const points: Array<[number, number]> = []
  for (let day = 1; day <= 365; day += 2) points.push([day, dayLength(latitude.value, solarDeclinationDeg(day)).hours])
  return [{ name: `昼长（${latLabel(latitude.value)}）`, color: DAY_LENGTH_COLOR, points, markY: [12] }]
})

const altitudeSeries = computed<ChartSeries[]>(() => {
  if (mode.value === 'latitude') {
    const points: Array<[number, number]> = []
    for (let lat = -90; lat <= 90; lat += 2) points.push([lat, noonAltitudeDeg(lat, declination.value)])
    return [{ name: '正午太阳高度', color: ALTITUDE_COLOR, points, markY: [0] }]
  }
  const points: Array<[number, number]> = []
  for (let day = 1; day <= 365; day += 2) points.push([day, noonAltitudeDeg(latitude.value, solarDeclinationDeg(day))])
  return [{ name: `正午太阳高度（${latLabel(latitude.value)}）`, color: ALTITUDE_COLOR, points, markY: [0] }]
})

const dayLengthTitle = computed(() => (mode.value === 'latitude' ? `昼长随纬度变化（${store.date}）` : '昼长随日期变化'))
const altitudeTitle = computed(() => (mode.value === 'latitude' ? `正午太阳高度随纬度变化（${store.date}）` : '正午太阳高度随日期变化'))
</script>

<template>
  <div class="solar-chart-panel">
    <div class="chart-header">
      <a-segmented
        v-model:value="mode"
        size="small"
        :options="[
          { value: 'latitude', label: '随纬度' },
          { value: 'date', label: '随日期' }
        ]"
        aria-label="曲线模式"
      />
      <span class="declination">太阳直射点 {{ declinationText }}</span>
      <a-button type="text" size="small" aria-label="关闭曲线面板" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </div>
    <div v-if="mode === 'date'" class="latitude-row">
      <span class="latitude-label">纬度</span>
      <a-slider
        :value="latitude"
        :min="-90"
        :max="90"
        :step="5"
        :marks="{ '-90': '90°S', 0: '0°', 90: '90°N' }"
        class="latitude-slider"
        aria-label="纬度选择"
        @change="(value: number) => (latitude = value)"
      />
      <span class="latitude-value">{{ latLabel(latitude) }}</span>
    </div>
    <div class="chart-title">{{ dayLengthTitle }}</div>
    <LineChart
      :series="dayLengthSeries"
      :x-min="mode === 'latitude' ? -90 : 1"
      :x-max="mode === 'latitude' ? 90 : 365"
      :x-name="mode === 'latitude' ? '纬度' : '日期'"
      :x-formatter="mode === 'latitude' ? latitudeFormatter : dateFormatter"
      y-name="小时"
      :y-min="0"
      :y-max="24"
      :height="168"
    />
    <div class="chart-title">{{ altitudeTitle }}</div>
    <LineChart
      :series="altitudeSeries"
      :x-min="mode === 'latitude' ? -90 : 1"
      :x-max="mode === 'latitude' ? 90 : 365"
      :x-name="mode === 'latitude' ? '纬度' : '日期'"
      :x-formatter="mode === 'latitude' ? latitudeFormatter : dateFormatter"
      y-name="度"
      :y-min="-90"
      :y-max="90"
      :height="168"
    />
  </div>
</template>

<style scoped>
.solar-chart-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px 16px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  box-shadow: var(--ant-box-shadow-secondary, 0 4px 12px rgba(0, 0, 0, 0.08));
}

.chart-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.declination {
  margin-left: auto;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.latitude-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.latitude-label {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
  flex: none;
}

.latitude-slider {
  flex: 1;
  margin: 0 0 8px;
}

.latitude-value {
  flex: none;
  min-width: 44px;
  text-align: right;
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  line-height: 20px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.chart-title {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  margin-top: 4px;
}
</style>
