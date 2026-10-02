<script setup lang="ts">
import { computed } from 'vue'
import { CaretRightOutlined, CloseOutlined, PauseOutlined } from '@ant-design/icons-vue'
import { useSolarStore, parseIsoDate } from '@renderer/stores/solar'
import {
  dayLengthHours,
  formatLatitude,
  formatLongitude,
  formatUtcHours,
  hemisphereHint,
  noonSolarElevation,
  solarDeclination,
  subsolarPoint
} from '@renderer/utils/solar'
import LatitudeChart from '@renderer/components/LatitudeChart.vue'

const store = useSolarStore()

const timeMarks: Record<number, string> = { 0: '0时', 6: '6时', 12: '12时', 18: '18时', 24: '24时' }

const input = computed(() => parseIsoDate(store.dateISO))
const subsolar = computed(() => subsolarPoint(input.value, store.utcHours))
const subsolarText = computed(() => `${formatLatitude(subsolar.value.latitude)}  ${formatLongitude(subsolar.value.longitude)}`)
const hint = computed(() => hemisphereHint(subsolar.value.latitude))

const dayLengthPoints = computed(() => {
  const points: Array<{ lat: number; value: number }> = []
  for (let lat = -90; lat <= 90; lat += 5) {
    points.push({ lat, value: dayLengthHours(lat, subsolar.value.latitude) })
  }
  return points
})

const elevationPoints = computed(() => {
  const points: Array<{ lat: number; value: number }> = []
  for (let lat = -90; lat <= 90; lat += 5) {
    points.push({ lat, value: noonSolarElevation(lat, subsolar.value.latitude) })
  }
  return points
})

const declinationText = computed(() => formatLatitude(solarDeclination(input.value)))

const toggles = computed(() => [
  { key: 'terminator' as const, label: '晨昏线', value: store.showTerminator },
  { key: 'subsolar' as const, label: '太阳直射点', value: store.showSubsolar },
  { key: 'lighting' as const, label: '昼夜光照', value: store.showLighting }
])
</script>

<template>
  <div v-if="store.panelOpen" class="solar-panel">
    <div class="panel-title">
      <div><div class="panel-kicker">SOLAR · TERMINATOR · DAYLIGHT</div><h2>昼夜光照 · 晨昏线</h2></div>
      <a-button type="text" aria-label="关闭昼夜光照面板" @click="store.setPanelOpen(false)"><CloseOutlined /></a-button>
    </div>
    <div class="date-row">
      <a-date-picker :value="store.dateISO" value-format="YYYY-MM-DD" size="small" class="date-picker" aria-label="模拟日期" @change="(value: string) => store.setDate(value ?? store.dateISO)" />
      <span class="declination-readout">直射纬度 {{ declinationText }}</span>
    </div>
    <div class="timeline-row">
      <a-button type="primary" size="small" :aria-label="store.playing ? '暂停昼夜动画' : '播放昼夜动画'" @click="store.togglePlay()">
        <CaretRightOutlined v-if="!store.playing" /><PauseOutlined v-else />
      </a-button>
      <a-slider :value="store.utcHours" :min="0" :max="24" :step="0.25" :marks="timeMarks" :tooltip="{ formatter: (value: number) => `${formatUtcHours(value)} UTC` }" class="time-slider" aria-label="UTC 时刻时间轴" @change="(value: number) => store.setUtcHours(value)" />
      <span class="time-readout">{{ formatUtcHours(store.utcHours) }}</span>
    </div>
    <div class="speed-row">
      <span class="speed-label">动画速度</span>
      <a-radio-group :value="store.speed" size="small" aria-label="动画速度" @change="(event: { target: { value: number } }) => store.setSpeed(event.target.value)">
        <a-radio-button :value="0.5">0.5 时/秒</a-radio-button>
        <a-radio-button :value="1">1 时/秒</a-radio-button>
        <a-radio-button :value="2">2 时/秒</a-radio-button>
        <a-radio-button :value="6">6 时/秒</a-radio-button>
      </a-radio-group>
      <span class="subsolar-readout">直射点 {{ subsolarText }}</span>
    </div>
    <p class="hint">{{ hint }}</p>
    <div class="toggle-grid">
      <label v-for="toggle in toggles" :key="toggle.key" class="toggle-item">
        <span>{{ toggle.label }}</span>
        <a-switch size="small" :checked="toggle.value" :aria-label="toggle.label" @change="(value: boolean) => store.toggleShow(toggle.key, value)" />
      </label>
    </div>
    <LatitudeChart title="昼长随纬度分布" unit="小时" :y-max="24" :points="dayLengthPoints" />
    <LatitudeChart title="正午太阳高度随纬度分布" unit="度" :y-max="90" :points="elevationPoints" />
  </div>
</template>

<style scoped>
.solar-panel {
  position: absolute;
  left: 76px;
  bottom: 16px;
  z-index: 90;
  width: 430px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  padding: 12px 16px;
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-kicker {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
  letter-spacing: 0.08em;
}

h2 {
  margin: 0;
  color: rgba(0, 0, 0, 0.88);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.date-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.date-picker {
  width: 150px;
}

.declination-readout {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.timeline-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.time-slider {
  flex: 1;
  margin: 0 8px 18px 8px;
}

.time-readout {
  flex: none;
  width: 46px;
  text-align: center;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.88);
}

.speed-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.speed-label {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 22px;
}

.subsolar-readout {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 22px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.hint {
  margin: 6px 0 8px;
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
