<script setup lang="ts">
import { computed, ref } from 'vue'

type HeatingState = 'day-clear' | 'day-cloudy' | 'night-clear' | 'night-cloudy'

interface RadiatorArrow {
  d: string
  color: string
  dashed?: boolean
  width?: number
  label?: string
  labelAt?: [number, number]
}

const state = ref<HeatingState>('day-clear')

const SOLAR = '#fa8c16'
const GROUND_RADIATION = '#f5222d'
const COUNTER_RADIATION = '#722ed1'

const stateOptions = [
  { value: 'day-clear', label: '白天·晴' },
  { value: 'day-cloudy', label: '白天·多云' },
  { value: 'night-clear', label: '夜晚·晴' },
  { value: 'night-cloudy', label: '夜晚·多云' }
] as const

const isDay = computed(() => state.value.startsWith('day'))
const isCloudy = computed(() => state.value.endsWith('cloudy'))

const arrows = computed<RadiatorArrow[]>(() => {
  const list: RadiatorArrow[] = []
  if (isDay.value) {
    if (isCloudy.value) {
      list.push(
        { d: 'M 62 40 L 196 54', color: SOLAR, label: '太阳短波辐射', labelAt: [96, 32] },
        { d: 'M 202 50 Q 252 34 272 20', color: SOLAR, dashed: true, label: '云层反射（削弱强）', labelAt: [262, 44] },
        { d: 'M 54 48 L 92 164', color: SOLAR, width: 1.6, label: '少量透过云隙', labelAt: [58, 120] }
      )
    } else {
      list.push(
        { d: 'M 62 40 L 148 164', color: SOLAR, width: 2.6, label: '太阳短波辐射', labelAt: [92, 84] },
        { d: 'M 46 46 L 66 104', color: SOLAR, width: 1.4, dashed: true, label: '被大气吸收、散射（削弱）', labelAt: [132, 108] }
      )
    }
  }
  if (isCloudy.value) {
    list.push(
      { d: 'M 118 164 L 118 76', color: GROUND_RADIATION, width: 2.2, label: '地面长波辐射', labelAt: [88, 132] },
      { d: 'M 246 164 L 246 78', color: GROUND_RADIATION, width: 2.2, dashed: true }
    )
  } else {
    list.push(
      { d: 'M 118 164 L 118 96', color: GROUND_RADIATION, width: 2.2, label: '地面长波辐射被大气吸收', labelAt: [148, 128] },
      { d: 'M 258 164 L 258 30', color: GROUND_RADIATION, width: 1.6, dashed: true, label: '少量逸散到宇宙空间', labelAt: [262, 92] }
    )
  }
  const counterWidth = state.value === 'night-cloudy' ? 3 : state.value === 'night-clear' ? 1.4 : 1.8
  const counterColor = COUNTER_RADIATION
  if (state.value === 'night-cloudy') {
    list.push(
      { d: 'M 96 96 L 84 162', color: counterColor, width: counterWidth, label: '大气逆辐射强（保温）', labelAt: [72, 84] },
      { d: 'M 186 92 L 172 162', color: counterColor, width: counterWidth }
    )
  } else if (state.value === 'night-clear') {
    list.push({ d: 'M 140 100 L 132 162', color: counterColor, width: counterWidth, label: '大气逆辐射弱', labelAt: [170, 88] })
  } else {
    list.push({ d: 'M 152 98 L 140 162', color: counterColor, width: counterWidth, label: '大气逆辐射', labelAt: [196, 96] })
  }
  return list
})

const stateConclusion = computed(() => {
  switch (state.value) {
    case 'day-clear':
      return '白天晴天：大气对太阳辐射削弱少，到达地面的太阳辐射多，气温升高快。'
    case 'day-cloudy':
      return '白天多云：云层反射太阳辐射，削弱作用强，到达地面的太阳辐射少，气温不会太高。'
    case 'night-clear':
      return '夜晚晴朗：云少则大气吸收地面辐射少、逆辐射弱，地面热量散失快，气温低——深秋寒霜多发生于晴朗夜晚。'
    case 'night-cloudy':
      return '夜晚多云：云吸收地面辐射多、逆辐射强，保温作用强，气温不会太低。'
  }
})

const keyPoints = [
  '太阳辐射是地球上最主要的能量来源',
  '大气对太阳辐射的削弱作用：吸收、反射、散射',
  '地面吸收太阳辐射增温后产生地面辐射，加热近地面大气——地面是近地面大气主要的直接热源',
  '大气逆辐射把热量还给地面，对地面起保温作用（温室效应原理类似）'
]
</script>

<template>
  <div class="heating-panel" role="group" aria-label="大气受热过程演示">
    <div class="panel-header">
      <span class="panel-title">大气受热过程</span>
      <a-segmented v-model:value="state" size="small" :options="[...stateOptions]" aria-label="昼夜与云量" />
    </div>
    <svg viewBox="0 0 320 200" class="heating-svg" role="img" aria-label="大气受热过程示意图：太阳辐射、地面辐射与大气逆辐射">
      <rect x="0" y="0" width="320" height="170" fill="rgba(22, 119, 255, 0.06)" />
      <text x="10" y="18" class="space-label">宇宙空间</text>
      <text v-if="!isDay" x="296" y="26" text-anchor="middle" class="space-label">月</text>
      <circle v-if="isDay" cx="46" cy="34" r="10" fill="#faad14" />
      <g v-if="isCloudy">
        <ellipse cx="200" cy="58" rx="34" ry="12" fill="rgba(0, 0, 0, 0.18)" />
        <ellipse cx="178" cy="62" rx="22" ry="10" fill="rgba(0, 0, 0, 0.14)" />
        <ellipse cx="224" cy="62" rx="24" ry="10" fill="rgba(0, 0, 0, 0.14)" />
        <text x="200" y="84" text-anchor="middle" class="tiny-label">云（水滴、冰晶）</text>
      </g>
      <path v-for="(arrow, index) in arrows" :key="`r-${index}`" :d="arrow.d" fill="none" :stroke="arrow.color" :stroke-width="arrow.width ?? 2.2" :stroke-dasharray="arrow.dashed ? '5 4' : undefined" marker-end="url(#heat-arrowhead)" class="heat-arrow" />
      <defs>
        <marker id="heat-arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="rgba(0,0,0,0.55)" />
        </marker>
      </defs>
      <g font-size="10.5" font-family='"Microsoft YaHei", "PingFang SC", sans-serif'>
        <text v-for="(arrow, index) in arrows.filter((item) => item.label && item.labelAt)" :key="`t-${index}`" :x="arrow.labelAt![0]" :y="arrow.labelAt![1]" text-anchor="middle" :fill="arrow.color">{{ arrow.label }}</text>
      </g>
      <rect x="0" y="170" width="320" height="30" fill="rgba(250, 140, 22, 0.18)" />
      <line x1="0" y1="170" x2="320" y2="170" stroke="rgba(0, 0, 0, 0.45)" stroke-width="1.5" />
      <text x="160" y="188" text-anchor="middle" class="ground-label">地面（吸收太阳辐射后增温）</text>
    </svg>
    <div class="panel-conclusion">{{ stateConclusion }}</div>
    <div class="key-points">
      <div v-for="point in keyPoints" :key="point" class="key-point">· {{ point }}</div>
    </div>
  </div>
</template>

<style scoped>
.heating-panel {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  gap: 12px;
}

.panel-title {
  margin-right: auto;
  color: rgba(0, 0, 0, 0.88);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.heating-svg {
  width: 100%;
  height: auto;
}

.heat-arrow {
  stroke-dasharray: none;
}

.space-label,
.tiny-label {
  fill: rgba(0, 0, 0, 0.45);
  font-size: 10px;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}

.ground-label {
  fill: rgba(0, 0, 0, 0.65);
  font-size: 11px;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}

.panel-conclusion {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  line-height: 20px;
  font-weight: 600;
}

.key-points {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.key-point {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 19px;
}
</style>
