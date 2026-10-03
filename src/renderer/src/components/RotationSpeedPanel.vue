<script setup lang="ts">
import { computed } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import LineChart, { type ChartSeries } from '@renderer/components/charts/LineChart.vue'

const emit = defineEmits<{ close: [] }>()

const EQUATOR_SPEED_KMH = 1670
const SPEED_COLOR = '#1677ff'

const latitudeFormatter = (value: number) => (value === 0 ? '0°' : `${Math.abs(value)}°${value > 0 ? 'N' : 'S'}`)

const speedSeries = computed<ChartSeries[]>(() => {
  const points: Array<[number, number]> = []
  for (let lat = -90; lat <= 90; lat += 2) {
    points.push([lat, EQUATOR_SPEED_KMH * Math.cos((lat * Math.PI) / 180)])
  }
  return [{ name: '自转线速度', color: SPEED_COLOR, points, markY: [EQUATOR_SPEED_KMH] }]
})

const SVG_WIDTH = 300
const SVG_HEIGHT = 158
const SUN = { x: 58, y: 96, r: 13 }
const E1 = { x: 152, y: 136, r: 10 }
const E2 = { x: 236, y: 70, r: 10 }
const STAR = { x: 18, y: 22 }

function toward(from: { x: number; y: number }, to: { x: number; y: number }, length: number): { x: number; y: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const norm = Math.hypot(dx, dy) || 1
  return { x: from.x + (dx / norm) * length, y: from.y + (dy / norm) * length }
}

const e1SunArrow = computed(() => toward(E1, SUN, 44))
const e2StarArrow = computed(() => {
  const dx = SUN.x - E1.x
  const dy = SUN.y - E1.y
  const norm = Math.hypot(dx, dy) || 1
  return { x: E2.x + (dx / norm) * 44, y: E2.y + (dy / norm) * 44 }
})
const e2SunArrow = computed(() => toward(E2, SUN, 44))

const facts = [
  { label: '角速度', value: '15°/小时（南北极点为 0）' },
  { label: '赤道线速度', value: '约 1670 千米/时（465 米/秒）' },
  { label: '60° 纬线线速度', value: '约 835 千米/时（赤道一半）' },
  { label: '恒星日', value: '23 时 56 分 4 秒 · 转 360°' },
  { label: '太阳日', value: '24 时 · 转 360°59′' },
  { label: '两者之差', value: '3 分 56 秒（一年累计恰好多转一圈）' }
]
</script>

<template>
  <div class="rotation-panel" role="group" aria-label="地球自转速度演示">
    <div class="panel-header">
      <span class="panel-title">地球自转的速度与周期</span>
      <a-button type="text" size="small" aria-label="关闭自转速度演示" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </div>
    <div class="chart-title">自转线速度随纬度变化（v = 1670 × cos φ 千米/时）</div>
    <LineChart
      :series="speedSeries"
      :x-min="-90"
      :x-max="90"
      x-name="纬度"
      :x-formatter="latitudeFormatter"
      y-name="千米/时"
      :y-min="0"
      :y-max="1800"
      :height="150"
    />
    <div class="chart-title">恒星日与太阳日（示意，59′ 夸大绘制）</div>
    <svg :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`" class="day-diagram" role="img" aria-label="恒星日与太阳日对比示意图：地球公转一段后需多转59分才能再次对准太阳">
      <line :x1="STAR.x" :y1="STAR.y" :x2="E1.x" :y2="E1.y" stroke="rgba(0, 0, 0, 0.2)" stroke-dasharray="3 4" />
      <line :x1="STAR.x" :y1="STAR.y" :x2="E2.x" :y2="E2.y" stroke="rgba(0, 0, 0, 0.2)" stroke-dasharray="3 4" />
      <g :transform="`translate(${STAR.x}, ${STAR.y})`">
        <circle r="3" fill="#722ed1" />
        <circle r="7" fill="none" stroke="#722ed1" stroke-dasharray="2 2" />
      </g>
      <text :x="STAR.x" :y="STAR.y - 12" class="axis-label" text-anchor="middle">遥远恒星</text>
      <g :transform="`translate(${SUN.x}, ${SUN.y})`">
        <circle :r="SUN.r" fill="#fa8c16" />
      </g>
      <text :x="SUN.x" :y="SUN.y + SUN.r + 14" class="axis-label" text-anchor="middle">太阳</text>
      <path d="M 165 122 Q 200 108 226 84" fill="none" stroke="rgba(0, 0, 0, 0.35)" stroke-dasharray="4 4" marker-end="url(#orbit-arrow)" />
      <defs>
        <marker id="orbit-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="rgba(0, 0, 0, 0.35)" />
        </marker>
        <marker id="solid-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1677ff" />
        </marker>
        <marker id="dash-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="rgba(22, 119, 255, 0.55)" />
        </marker>
      </defs>
      <text x="196" y="122" class="axis-label">公转方向</text>
      <circle :cx="E1.x" :cy="E1.y" :r="E1.r" fill="#52c41a" stroke="#ffffff" stroke-width="2" />
      <line :x1="E1.x" :y1="E1.y" :x2="e1SunArrow.x" :y2="e1SunArrow.y" stroke="#1677ff" stroke-width="2" marker-end="url(#solid-arrow)" />
      <text :x="E1.x + 4" :y="E1.y - 16" class="earth-label">位置① P 指向太阳（也是恒星方向）</text>
      <circle :cx="E2.x" :cy="E2.y" :r="E2.r" fill="#52c41a" stroke="#ffffff" stroke-width="2" />
      <line :x1="E2.x" :y1="E2.y" :x2="e2StarArrow.x" :y2="e2StarArrow.y" stroke="#1677ff" stroke-width="2" marker-end="url(#solid-arrow)" />
      <line :x1="E2.x" :y1="E2.y" :x2="e2SunArrow.x" :y2="e2SunArrow.y" stroke="rgba(22, 119, 255, 0.55)" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#dash-arrow)" />
      <text :x="E2.x + 6" :y="E2.y - 24" class="earth-label">位置② 已转 360°：P 仍指恒星（恒星日）</text>
      <text :x="E2.x + 6" :y="E2.y - 12" class="earth-label-dim">还需再转 59′ 才对准太阳（太阳日）</text>
      <text :x="E2.x - 44" :y="E2.y + 26" class="axis-label">约59′</text>
    </svg>
    <div class="readout-grid">
      <div v-for="fact in facts" :key="fact.label" class="readout-item">
        <span class="readout-label">{{ fact.label }}</span>
        <span class="readout-value">{{ fact.value }}</span>
      </div>
    </div>
    <div class="panel-note">线速度由赤道向两极递减；同一纬线各点角速度、线速度相同。图示角度经夸大，实际每日多转约 59′。</div>
  </div>
</template>

<style scoped>
.rotation-panel {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 360px;
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

.day-diagram {
  width: 100%;
  height: auto;
}

.axis-label {
  fill: rgba(0, 0, 0, 0.45);
  font-size: 10px;
}

.earth-label {
  fill: rgba(0, 0, 0, 0.65);
  font-size: 10px;
}

.earth-label-dim {
  fill: rgba(0, 0, 0, 0.45);
  font-size: 10px;
}

.readout-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 12px;
}

.readout-item {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.readout-label {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 18px;
}

.readout-value {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  line-height: 20px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.panel-note {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
}
</style>
