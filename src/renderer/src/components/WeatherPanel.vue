<script setup lang="ts">
import { computed } from 'vue'
import { CaretRightOutlined, PauseOutlined } from '@ant-design/icons-vue'
import { useWeatherStore, type FrontKind, type HemisphereKind, type PressureSystemKind } from '@renderer/stores/weather'
import { useTeachingStore } from '@renderer/stores/teaching'
import { TYPHOON_EVENTS } from '@renderer/utils/typhoonData'

const store = useWeatherStore()
const teachingStore = useTeachingStore()

const frontOptions: Array<{ value: FrontKind; label: string }> = [
  { value: 'cold', label: '冷锋' },
  { value: 'warm', label: '暖锋' },
  { value: 'stationary', label: '准静止锋' }
]

const frontText = computed(() => {
  if (store.front === 'cold') return '冷气团主动推进：锋面过境时大风、降温，常出现狂风暴雨或雨雪；过境后气压升高、气温骤降、天气转晴。'
  if (store.front === 'warm') return '暖气团沿冷气团缓慢爬升：锋面过境前多连续性降水，过境后气温上升、气压下降、天气转晴。'
  return '冷暖气团势均力敌，锋面来回摆动：江淮流域初夏的梅雨即准静止锋造成的长时间阴雨。'
})

const systemOptions: Array<{ value: PressureSystemKind; label: string }> = [
  { value: 'low', label: '气旋（低压）' },
  { value: 'high', label: '反气旋（高压）' }
]

const hemisphereOptions: Array<{ value: HemisphereKind; label: string }> = [
  { value: 'north', label: '北半球' },
  { value: 'south', label: '南半球' }
]

const rotationText = computed(() => {
  const cyclonic = (store.hemisphere === 'north') === (store.systemKind === 'low')
  const kindText = store.systemKind === 'low' ? '中心气流上升，多阴雨天气' : '中心气流下沉，天气晴朗'
  return `${store.hemisphere === 'north' ? '北' : '南'}半球${store.systemKind === 'low' ? '气旋' : '反气旋'}：水平气流${cyclonic ? '逆' : '顺'}时针辐${store.systemKind === 'low' ? '合' : '散'}，${kindText}`
})

const cycloneArrows = computed(() => {
  const ccw = (store.hemisphere === 'north') === (store.systemKind === 'low')
  const inward = store.systemKind === 'low'
  const s = ccw ? 1 : -1
  return [45, 135, 225, 315].map((theta) => {
    const rad = (theta * Math.PI) / 180
    const x = 120 + 74 * Math.cos(rad)
    const y = 120 - 74 * Math.sin(rad)
    const tangent = theta + s * 90
    const direction = inward ? tangent + s * 30 : tangent - s * 30
    return { x, y, rotation: direction }
  })
})

const typhoonOptions = TYPHOON_EVENTS.map((event) => ({ value: event.id, label: `${event.name}（${event.year}）` }))
const tracksVisible = computed(() => teachingStore.isLayerVisible('typhoon-tracks'))
</script>

<template>
  <div class="weather-pane">
    <div class="section-heading">锋面系统</div>
    <a-segmented :value="store.front" :options="frontOptions" size="small" class="front-segmented" @change="(value: string | number) => store.setFront(value as FrontKind)" />

    <svg v-if="store.front === 'cold'" viewBox="0 0 420 170" class="front-svg" role="img" aria-label="冷锋剖面示意">
      <rect x="0" y="0" width="420" height="170" fill="#f7f9fc" />
      <line x1="0" y1="150" x2="420" y2="150" stroke="#8c8c8c" stroke-width="2" />
      <polygon points="0,150 260,150 200,110 150,150" fill="#2f54eb" opacity="0.25" />
      <polygon points="250,150 420,150 420,120 300,120" fill="#2f54eb" opacity="0.15" />
      <rect x="250" y="30" width="170" height="90" fill="#fa8c16" opacity="0.12" />
      <g class="air-push">
        <line x1="60" y1="128" x2="140" y2="128" stroke="#2f54eb" stroke-width="3" />
        <polygon points="140,122 152,128 140,134" fill="#2f54eb" />
      </g>
      <g class="air-rise">
        <path d="M 260 120 Q 250 90 265 70" fill="none" stroke="#fa8c16" stroke-width="3" />
        <polygon points="260,64 268,72 258,76" fill="#fa8c16" />
      </g>
      <ellipse cx="235" cy="52" rx="42" ry="16" fill="#bfbfbf" />
      <ellipse cx="262" cy="42" rx="34" ry="14" fill="#d4d4d4" />
      <ellipse cx="215" cy="42" rx="28" ry="12" fill="#a6a6a6" />
      <g class="rain">
        <line x1="215" y1="70" x2="210" y2="96" stroke="#1677ff" stroke-width="2" />
        <line x1="235" y1="70" x2="230" y2="100" stroke="#1677ff" stroke-width="2" />
        <line x1="255" y1="70" x2="250" y2="96" stroke="#1677ff" stroke-width="2" />
        <line x1="205" y1="76" x2="200" y2="104" stroke="#1677ff" stroke-width="2" />
        <line x1="245" y1="76" x2="240" y2="106" stroke="#1677ff" stroke-width="2" />
      </g>
      <g>
        <polygon points="180,150 188,138 196,150" fill="#2f54eb" />
        <polygon points="205,150 213,138 221,150" fill="#2f54eb" />
        <polygon points="230,150 238,138 246,150" fill="#2f54eb" />
        <polygon points="255,150 263,138 271,150" fill="#2f54eb" />
      </g>
      <text x="60" y="145" class="svg-label" fill="#2f54eb">冷气团</text>
      <text x="330" y="145" class="svg-label" fill="#fa8c16">暖气团</text>
      <text x="196" y="166" class="svg-label" fill="#595959">锋线（三角指向移动方向）</text>
    </svg>

    <svg v-else-if="store.front === 'warm'" viewBox="0 0 420 170" class="front-svg" role="img" aria-label="暖锋剖面示意">
      <rect x="0" y="0" width="420" height="170" fill="#fffaf0" />
      <line x1="0" y1="150" x2="420" y2="150" stroke="#8c8c8c" stroke-width="2" />
      <polygon points="0,150 220,150 220,115 150,118" fill="#2f54eb" opacity="0.15" />
      <polygon points="230,150 420,150 420,118 260,118" fill="#2f54eb" opacity="0.25" />
      <rect x="0" y="30" width="230" height="85" fill="#fa8c16" opacity="0.10" />
      <g class="air-push">
        <line x1="40" y1="128" x2="120" y2="128" stroke="#fa8c16" stroke-width="3" />
        <polygon points="120,122 132,128 120,134" fill="#fa8c16" />
      </g>
      <path d="M 150 118 Q 130 84 160 58 Q 200 34 250 30" fill="none" stroke="#fa8c16" stroke-width="3" class="air-slide" />
      <ellipse cx="230" cy="46" rx="52" ry="14" fill="#bfbfbf" />
      <ellipse cx="290" cy="44" rx="60" ry="15" fill="#d4d4d4" />
      <ellipse cx="350" cy="46" rx="48" ry="13" fill="#e8e8e8" />
      <g class="rain">
        <line x1="280" y1="62" x2="275" y2="90" stroke="#1677ff" stroke-width="2" />
        <line x1="310" y1="62" x2="305" y2="94" stroke="#1677ff" stroke-width="2" />
        <line x1="340" y1="62" x2="335" y2="90" stroke="#1677ff" stroke-width="2" />
        <line x1="295" y1="66" x2="290" y2="100" stroke="#1677ff" stroke-width="2" />
        <line x1="325" y1="66" x2="320" y2="100" stroke="#1677ff" stroke-width="2" />
      </g>
      <g>
        <path d="M 190 150 A 8 8 0 0 1 206 150" fill="none" stroke="#fa8c16" stroke-width="3" />
        <path d="M 215 150 A 8 8 0 0 1 231 150" fill="none" stroke="#fa8c16" stroke-width="3" />
        <path d="M 240 150 A 8 8 0 0 1 256 150" fill="none" stroke="#fa8c16" stroke-width="3" />
      </g>
      <text x="60" y="145" class="svg-label" fill="#fa8c16">暖气团</text>
      <text x="330" y="145" class="svg-label" fill="#2f54eb">冷气团</text>
      <text x="196" y="166" class="svg-label" fill="#595959">锋线（半圆指向移动方向）</text>
    </svg>

    <svg v-else viewBox="0 0 420 170" class="front-svg" role="img" aria-label="准静止锋示意">
      <rect x="0" y="0" width="420" height="170" fill="#f6ffed" />
      <line x1="0" y1="150" x2="420" y2="150" stroke="#8c8c8c" stroke-width="2" />
      <rect x="0" y="26" width="170" height="122" fill="#2f54eb" opacity="0.08" />
      <rect x="250" y="26" width="170" height="122" fill="#fa8c16" opacity="0.10" />
      <g class="air-push">
        <line x1="120" y1="120" x2="185" y2="120" stroke="#2f54eb" stroke-width="3" />
        <polygon points="185,114 197,120 185,126" fill="#2f54eb" />
      </g>
      <g class="air-push-slow">
        <line x1="300" y1="120" x2="235" y2="120" stroke="#fa8c16" stroke-width="3" />
        <polygon points="235,114 223,120 235,126" fill="#fa8c16" />
      </g>
      <ellipse cx="175" cy="52" rx="70" ry="20" fill="#a6a6a6" />
      <ellipse cx="230" cy="44" rx="64" ry="18" fill="#bfbfbf" />
      <ellipse cx="185" cy="38" rx="52" ry="15" fill="#8f8f8f" />
      <g class="rain">
        <line x1="160" y1="66" x2="155" y2="96" stroke="#1677ff" stroke-width="2" />
        <line x1="190" y1="66" x2="185" y2="100" stroke="#1677ff" stroke-width="2" />
        <line x1="220" y1="66" x2="215" y2="96" stroke="#1677ff" stroke-width="2" />
        <line x1="245" y1="62" x2="240" y2="96" stroke="#1677ff" stroke-width="2" />
      </g>
      <g>
        <polygon points="190,150 196,141 202,150" fill="#2f54eb" />
        <path d="M 210 150 A 7 7 0 0 1 224 150" fill="none" stroke="#fa8c16" stroke-width="3" />
        <polygon points="232,150 238,141 244,150" fill="#2f54eb" />
        <path d="M 252 150 A 7 7 0 0 1 266 150" fill="none" stroke="#fa8c16" stroke-width="3" />
      </g>
      <text x="55" y="145" class="svg-label" fill="#2f54eb">冷气团</text>
      <text x="320" y="145" class="svg-label" fill="#fa8c16">暖气团</text>
      <text x="150" y="166" class="svg-label" fill="#595959">两侧标记相对 · 锋面来回摆动</text>
    </svg>

    <p class="hint">{{ frontText }}</p>

    <div class="section-heading system-heading">气旋与反气旋</div>
    <div class="system-row">
      <a-segmented :value="store.systemKind" :options="systemOptions" size="small" @change="(value: string | number) => store.setSystemKind(value as PressureSystemKind)" />
      <a-segmented :value="store.hemisphere" :options="hemisphereOptions" size="small" @change="(value: string | number) => store.setHemisphere(value as HemisphereKind)" />
    </div>
    <svg viewBox="0 0 240 200" class="cyclone-svg" role="img" aria-label="气旋反气旋俯视示意">
      <circle cx="120" cy="100" r="86" fill="none" stroke="#bfbfbf" stroke-width="1" />
      <circle cx="120" cy="100" r="64" fill="none" stroke="#8c8c8c" stroke-width="1.4" />
      <circle cx="120" cy="100" r="42" fill="none" stroke="#595959" stroke-width="1.8" />
      <circle cx="120" cy="100" r="20" fill="none" stroke="#404040" stroke-width="2.2" />
      <g v-for="(arrow, index) in cycloneArrows" :key="index" :transform="`translate(${arrow.x} ${arrow.y}) rotate(${-arrow.rotation})`">
        <line x1="-14" y1="0" x2="8" y2="0" :stroke="store.systemKind === 'low' ? '#1677ff' : '#fa8c16'" stroke-width="3" />
        <polygon points="8,-5 20,0 8,5" :fill="store.systemKind === 'low' ? '#1677ff' : '#fa8c16'" />
      </g>
      <text x="120" y="106" text-anchor="middle" class="center-letter" :fill="store.systemKind === 'low' ? '#1677ff' : '#fa8c16'">{{ store.systemKind === 'low' ? 'L' : 'H' }}</text>
      <text x="120" y="188" text-anchor="middle" class="svg-label" fill="#595959">等压线与风向（俯视）</text>
    </svg>
    <p class="hint">{{ rotationText }}</p>

    <div class="section-heading system-heading">台风路径回放</div>
    <div class="typhoon-row">
      <a-select :value="store.typhoonId" size="small" class="typhoon-select" :options="typhoonOptions" @change="(value: string) => store.setTyphoon(value)"></a-select>
      <a-button type="primary" size="small" :aria-label="store.typhoonPlaying ? '暂停回放' : '播放回放'" @click="store.togglePlay()">
        <CaretRightOutlined v-if="!store.typhoonPlaying" /><PauseOutlined v-else />
      </a-button>
    </div>
    <a-slider :value="store.typhoonProgress" :min="0" :max="1" :step="0.01" :tooltip="{ formatter: () => `${store.typhoonReadout.date} · ${store.typhoonReadout.category}` }" aria-label="台风路径进度" @change="(value: number) => (store.typhoonProgress = value)" />
    <div class="typhoon-readout">
      <span>{{ store.typhoon.name }} · {{ store.typhoonReadout.date }}</span>
      <span class="typhoon-category">{{ store.typhoonReadout.category }} · {{ store.typhoonReadout.windMs }} m/s</span>
    </div>
    <div class="typhoon-track-row">
      <span>显示全部路径图层</span>
      <a-switch size="small" :checked="tracksVisible" @change="(value: boolean) => teachingStore.setLayerVisible('typhoon-tracks', value === true)" />
    </div>
    <p class="hint">{{ store.typhoon.summary }}</p>
  </div>
</template>

<style scoped>
.weather-pane {
  display: flex;
  flex-direction: column;
}

.section-heading {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
  margin-bottom: 6px;
}

.system-heading {
  margin-top: 12px;
}

.front-segmented {
  margin-bottom: 6px;
}

.front-svg,
.cyclone-svg {
  width: 100%;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 6px;
}

.svg-label {
  font-size: 11px;
}

.center-letter {
  font-size: 26px;
  font-weight: 600;
}

.rain line {
  animation: rain-fall 0.9s linear infinite;
}

.air-push {
  animation: air-slide 2.2s ease-in-out infinite alternate;
}

.air-push-slow {
  animation: air-slide 3.2s ease-in-out infinite alternate;
}

.air-rise,
.air-slide {
  animation: air-pulse 2.6s ease-in-out infinite alternate;
}

@keyframes rain-fall {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(26px);
    opacity: 0;
  }
}

@keyframes air-slide {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(12px);
  }
}

@keyframes air-pulse {
  from {
    opacity: 0.55;
  }
  to {
    opacity: 1;
  }
}

.hint {
  margin: 6px 0 0;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}

.system-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.typhoon-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.typhoon-select {
  flex: 1;
}

.typhoon-readout {
  display: flex;
  justify-content: space-between;
  color: rgba(0, 0, 0, 0.88);
  font-size: 13px;
  line-height: 22px;
}

.typhoon-category {
  color: #d4380d;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
}

.typhoon-track-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
  line-height: 22px;
}
</style>
