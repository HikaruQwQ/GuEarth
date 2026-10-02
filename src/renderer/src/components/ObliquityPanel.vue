<script setup lang="ts">
import { computed, ref } from 'vue'
import { CloseOutlined, UndoOutlined } from '@ant-design/icons-vue'

const emit = defineEmits<{ close: [] }>()

const REAL_OBLIQUITY = 23.5
const obliquity = ref(REAL_OBLIQUITY)

const CURVE_WIDTH = 292
const CURVE_HEIGHT = 128
const CURVE_TOP_PAD = 6
const BAR_HEIGHT = 208
const BAR_WIDTH = 22
const TROPIC_COLOR = '#fa8c16'
const TEMPERATE_COLOR = '#52c41a'
const FRIGID_COLOR = '#1677ff'

const SEASON_MARKS = [
  { day: 80, label: '春分' },
  { day: 172, label: '夏至' },
  { day: 266, label: '秋分' },
  { day: 355, label: '冬至' }
]

const curvePoints = computed(() => {
  const usableHeight = CURVE_HEIGHT - CURVE_TOP_PAD * 2
  const points: string[] = []
  for (let day = 1; day <= 365; day += 2) {
    const declination = obliquity.value * Math.sin(((360 * (284 + day)) / 365) * (Math.PI / 180))
    const x = ((day - 1) / 365) * CURVE_WIDTH
    const y = CURVE_TOP_PAD + ((90 - declination) / 180) * usableHeight
    points.push(`${points.length === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return points.join(' ')
})

function curveY(latitude: number): number {
  const usableHeight = CURVE_HEIGHT - CURVE_TOP_PAD * 2
  return CURVE_TOP_PAD + ((90 - latitude) / 180) * usableHeight
}

interface ZoneSegment {
  name: string
  south: number
  north: number
  color: string
  labelable: boolean
}

const zoneSegments = computed<ZoneSegment[]>(() => {
  const polar = 90 - obliquity.value
  const tropic = obliquity.value
  return [
    { name: '北寒带', south: polar, north: 90, color: FRIGID_COLOR, labelable: 90 - polar >= 10 },
    { name: '北温带', south: tropic, north: polar, color: TEMPERATE_COLOR, labelable: polar - tropic >= 10 },
    { name: '热带', south: -tropic, north: tropic, color: TROPIC_COLOR, labelable: 2 * tropic >= 10 },
    { name: '南温带', south: -polar, north: -tropic, color: TEMPERATE_COLOR, labelable: polar - tropic >= 10 },
    { name: '南寒带', south: -90, north: -polar, color: FRIGID_COLOR, labelable: 90 - polar >= 10 }
  ]
})

function barY(latitude: number): number {
  return ((90 - latitude) / 180) * BAR_HEIGHT
}

const boundaryMarks = computed(() => [
  { latitude: 90, label: '90°N' },
  { latitude: 90 - obliquity.value, label: `极圈 ${fmt(90 - obliquity.value)}°` },
  { latitude: obliquity.value, label: `回归线 ${fmt(obliquity.value)}°` },
  { latitude: 0, label: '0°' },
  { latitude: -obliquity.value, label: `回归线 ${fmt(obliquity.value)}°` },
  { latitude: -(90 - obliquity.value), label: `极圈 ${fmt(90 - obliquity.value)}°` },
  { latitude: -90, label: '90°S' }
])

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

const zoneWidthText = computed(() => {
  const polar = 90 - obliquity.value
  const tropic = obliquity.value
  return [
    `热带跨度 ${fmt(2 * tropic)}°`,
    `温带跨度 ${fmt(polar - tropic)}°`,
    `寒带跨度 ${fmt(90 - polar)}°`
  ]
})

const conclusion = computed(() => {
  if (obliquity.value === 0) return '交角为 0°：太阳始终直射赤道，全球全年昼夜等长，没有直射与极昼极夜现象，也就没有五带与四季之分。'
  if (obliquity.value === REAL_OBLIQUITY) return '交角为 23.5°（现实值）：直射点在南北回归线之间做回归运动，回归线与极圈之间为温带，五带划分如图。'
  return obliquity.value > REAL_OBLIQUITY
    ? '交角增大：直射范围与极昼极夜范围都向中纬度扩展，热带、寒带变宽，温带变窄，正午太阳高度与昼夜长短的年变化更剧烈。'
    : '交角减小：直射范围与极昼极夜范围收缩，热带、寒带变窄，温带变宽，昼夜长短与正午太阳高度的年变化趋于平缓。'
})
</script>

<template>
  <div class="obliquity-panel" role="group" aria-label="黄赤交角可调探究">
    <div class="panel-header">
      <span class="panel-title">黄赤交角可调探究</span>
      <a-button type="text" size="small" aria-label="恢复真实黄赤交角 23.5 度" @click="obliquity = REAL_OBLIQUITY">
        <UndoOutlined />
      </a-button>
      <a-button type="text" size="small" aria-label="关闭黄赤交角探究" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </div>
    <div class="slider-row">
      <span class="row-label">黄赤交角</span>
      <a-slider
        v-model:value="obliquity"
        :min="0"
        :max="45"
        :step="0.5"
        :marks="{ 0: '0°', 23.5: '23.5°', 45: '45°' }"
        class="obliquity-slider"
        aria-label="黄赤交角"
      />
      <span class="row-value">{{ fmt(obliquity) }}°</span>
    </div>
    <div class="chart-title">直射点回归运动（横轴：一年日期）</div>
    <svg :viewBox="`0 ${-CURVE_TOP_PAD} ${CURVE_WIDTH} ${CURVE_HEIGHT + CURVE_TOP_PAD + 18}`" class="declination-curve" role="img" aria-label="太阳直射点纬度随日期变化的正弦曲线">
      <line x1="0" :y1="curveY(0)" :x2="CURVE_WIDTH" :y2="curveY(0)" stroke="rgba(0, 0, 0, 0.25)" stroke-width="1" stroke-dasharray="4 3" />
      <line x1="0" :y1="curveY(obliquity)" :x2="CURVE_WIDTH" :y2="curveY(obliquity)" stroke="rgba(250, 140, 22, 0.55)" stroke-width="1" stroke-dasharray="4 3" />
      <line x1="0" :y1="curveY(-obliquity)" :x2="CURVE_WIDTH" :y2="curveY(-obliquity)" stroke="rgba(250, 140, 22, 0.55)" stroke-width="1" stroke-dasharray="4 3" />
      <path :d="curvePoints" fill="none" :stroke="TROPIC_COLOR" stroke-width="2" />
      <text :x="CURVE_WIDTH - 4" :y="curveY(obliquity) - 4" class="axis-label" text-anchor="end">北回归线 {{ fmt(obliquity) }}°N</text>
      <text :x="CURVE_WIDTH - 4" :y="curveY(-obliquity) + 12" class="axis-label" text-anchor="end">南回归线 {{ fmt(obliquity) }}°S</text>
      <text :x="CURVE_WIDTH - 4" :y="curveY(0) - 4" class="axis-label" text-anchor="end">赤道 0°</text>
      <g v-for="mark in SEASON_MARKS" :key="mark.label">
        <line :x1="(mark.day / 365) * CURVE_WIDTH" :y1="CURVE_HEIGHT" :x2="(mark.day / 365) * CURVE_WIDTH" :y2="CURVE_HEIGHT + 4" stroke="rgba(0, 0, 0, 0.45)" />
        <text :x="(mark.day / 365) * CURVE_WIDTH" :y="CURVE_HEIGHT + 16" class="axis-label" text-anchor="middle">{{ mark.label }}</text>
      </g>
    </svg>
    <div class="chart-title">五带划分（随交角变化）</div>
    <div class="zone-row">
      <svg :viewBox="`-58 0 ${BAR_WIDTH + 58 + 86} ${BAR_HEIGHT}`" class="zone-bar" role="img" aria-label="五带划分随黄赤交角变化的纬度条">
        <g v-for="mark in boundaryMarks" :key="`${mark.label}-${mark.latitude}`">
          <line x1="-6" :y1="barY(mark.latitude)" :x2="-2" :y2="barY(mark.latitude)" stroke="rgba(0, 0, 0, 0.45)" />
          <text x="-8" :y="barY(mark.latitude) + 4" class="axis-label" text-anchor="end">{{ mark.label }}</text>
        </g>
        <rect v-for="segment in zoneSegments" :key="segment.name" x="0" :y="barY(segment.north)" :width="BAR_WIDTH" :height="Math.max(0, barY(segment.south) - barY(segment.north))" :fill="segment.color" opacity="0.75" />
        <text x="-58" y="10" class="axis-label">极昼极夜最低纬度 {{ fmt(90 - obliquity) }}°</text>
        <g v-for="segment in zoneSegments.filter((item) => item.labelable)" :key="`label-${segment.name}`">
          <text :x="BAR_WIDTH + 8" :y="(barY(segment.north) + barY(segment.south)) / 2 + 4" class="zone-label" :fill="segment.color">{{ segment.name }}</text>
        </g>
      </svg>
      <div class="zone-facts">
        <div v-for="fact in zoneWidthText" :key="fact" class="fact-item">{{ fact }}</div>
        <div class="fact-item">极昼极夜 ≥{{ fmt(90 - obliquity) }}°</div>
        <div class="fact-item">直射范围 ±{{ fmt(obliquity) }}°</div>
      </div>
    </div>
    <div class="panel-note">{{ conclusion }}</div>
  </div>
</template>

<style scoped>
.obliquity-panel {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 340px;
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
  gap: 4px;
}

.panel-title {
  margin-right: auto;
  color: rgba(0, 0, 0, 0.88);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.row-label {
  flex: none;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}

.row-value {
  flex: none;
  min-width: 44px;
  text-align: right;
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  line-height: 20px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.obliquity-slider {
  flex: 1;
  margin: 0 0 10px;
}

.chart-title {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.declination-curve {
  width: 100%;
  height: auto;
}

.axis-label {
  fill: rgba(0, 0, 0, 0.45);
  font-size: 10px;
}

.zone-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.zone-bar {
  flex: none;
  height: 208px;
}

.zone-label {
  font-size: 12px;
  font-weight: 600;
}

.zone-facts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 26px;
}

.fact-item {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  line-height: 18px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  white-space: nowrap;
}

.panel-note {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}
</style>
