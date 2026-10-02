<script setup lang="ts">
import { computed } from 'vue'
import { CaretRightOutlined, PauseOutlined } from '@ant-design/icons-vue'
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

interface ZoneCard {
  offset: number
  name: string
  localText: string
  dateLabel: string
  beijing: boolean
}

function zoneName(offset: number): string {
  if (offset === 0) return '中时区'
  if (offset === 12) return '东十二区'
  if (offset === -12) return '西十二区'
  return offset > 0 ? `东${offset}区` : `西${-offset}区`
}

const zoneCards = computed<ZoneCard[]>(() => {
  const cards: ZoneCard[] = []
  for (let offset = 12; offset >= -12; offset--) {
    const total = store.utcHours + offset
    const dayShift = Math.floor(total / 24)
    const localHours = ((total % 24) + 24) % 24
    const hours = Math.floor(localHours)
    const minutes = Math.round((localHours - hours) * 60)
    const normalized = minutes === 60 ? { h: (hours + 1) % 24, m: 0 } : { h: hours, m: minutes }
    cards.push({
      offset,
      name: zoneName(offset),
      localText: `${String(normalized.h).padStart(2, '0')}:${String(normalized.m).padStart(2, '0')}`,
      dateLabel: dayShift === 0 ? '今天' : dayShift === 1 ? '明天' : '昨天',
      beijing: offset === 8
    })
  }
  return cards
})
</script>

<template>
  <div class="solar-pane">
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
    <div class="zone-section">
      <div class="zone-heading"><span>时区与日期（随上方时刻联动）</span></div>
      <div class="zone-strip">
        <div v-for="card in zoneCards" :key="card.offset" :class="['zone-card', { beijing: card.beijing, tomorrow: card.dateLabel === '明天', yesterday: card.dateLabel === '昨天' }]">
          <span class="zone-name">{{ card.name }}</span>
          <span class="zone-time">{{ card.localText }}</span>
          <span class="zone-date">{{ card.dateLabel }}</span>
          <span v-if="card.beijing" class="zone-tag">北京时间</span>
        </div>
      </div>
      <p class="zone-note">180° 经线为日界线：东十二区（西侧）总比西十二区（东侧）早一天。</p>
    </div>
  </div>
</template>

<style scoped>
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

.zone-section {
  margin-top: 12px;
}

.zone-heading {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
  margin-bottom: 6px;
}

.zone-strip {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.zone-card {
  flex: none;
  width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 4px 0;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 6px;
  background: rgba(22, 119, 255, 0.03);
}

.zone-card.beijing {
  border-color: #1677ff;
  background: rgba(22, 119, 255, 0.08);
}

.zone-card.tomorrow {
  border-color: rgba(82, 196, 26, 0.45);
}

.zone-card.yesterday {
  border-color: rgba(250, 140, 22, 0.45);
}

.zone-name {
  color: rgba(0, 0, 0, 0.65);
  font-size: 11px;
  line-height: 16px;
}

.zone-time {
  color: rgba(0, 0, 0, 0.88);
  font-size: 13px;
  line-height: 18px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.zone-date {
  color: rgba(0, 0, 0, 0.45);
  font-size: 10px;
  line-height: 14px;
}

.zone-tag {
  color: #1677ff;
  font-size: 10px;
  line-height: 14px;
}

.zone-note {
  margin: 6px 0 0;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
}
</style>
