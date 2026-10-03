<script setup lang="ts">
import { computed, ref } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'

const emit = defineEmits<{ close: [] }>()

type Tab = 'wave' | 'tide'
const tab = ref<Tab>('wave')
const tideMode = ref<'spring' | 'neap'>('spring')

const tabOptions = [
  { value: 'wave', label: '波浪' },
  { value: 'tide', label: '潮汐' }
] as const

const tideModeOptions = [
  { value: 'spring', label: '大潮（朔望）' },
  { value: 'neap', label: '小潮（上下弦）' }
] as const

const moonAngle = computed(() => (tideMode.value === 'spring' ? 0 : 90))
const moonX = computed(() => 170 + 74 * Math.cos((moonAngle.value * Math.PI) / 180))
const moonY = computed(() => 96 - 74 * Math.sin((moonAngle.value * Math.PI) / 180))

const waveFacts = [
  '波浪：风摩擦海面将能量传给海水，水质点大致沿圆形轨道运动，波形向前传播而水质点几乎不随波前进。',
  '深水区水质点轨道接近圆形；浅水区受海底摩擦，轨道变扁，波高增大，最终波峰前倾破碎形成拍岸浪。',
  '波浪是塑造海岸地貌（海蚀崖、海蚀柱、沙滩）的主要外力之一。'
]

const tideFacts = computed(() =>
  tideMode.value === 'spring'
    ? [
        '大潮：日、月、地三者大致呈直线（农历初一朔、十五望），太阳潮与太阴潮叠加，潮差最大。',
        '对月一侧因月球引力直接吸引海水隆起，背月一侧因惯性离心力隆起，全球同时出现两个潮汐隆起。',
        '钱塘江大潮（农历八月十八前后）即天文大潮叠加上宽下窄喇叭口地形的放大效果。'
      ]
      : [
        '小潮：日、月、地三者呈直角（农历初八上弦、廿三下弦），太阳潮削弱太阴潮，潮差最小。',
        '月球引潮力约为太阳引潮力的 2.2 倍，月球是潮汐的主导因素。',
        '潮汐昼夜两涨两落；渔港赶海、潮汐发电、大型舰船趁潮进出港都是对潮汐规律的利用。'
      ]
)
</script>

<template>
  <div class="tide-panel" role="group" aria-label="潮汐与波浪演示">
    <div class="panel-header">
      <span class="panel-title">潮汐与波浪</span>
      <a-segmented v-model:value="tab" size="small" :options="[...tabOptions]" aria-label="波浪或潮汐" />
      <a-button type="text" size="small" aria-label="关闭潮汐与波浪" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </div>
    <svg v-if="tab === 'wave'" viewBox="0 0 340 200" class="tide-svg" role="img" aria-label="波浪与水质点运动示意">
      <path d="M0 130 L340 130 L340 200 L0 200 Z" fill="rgba(22, 119, 255, 0.18)" />
      <path d="M0 130 L60 118 L340 96 L340 130 Z" fill="rgba(22, 119, 255, 0.28)" />
      <g class="wave-move">
        <path d="M-170 96 Q -127.5 66 -85 96 T 0 96 T 85 96 T 170 96 T 255 96 T 340 96 T 425 96 T 510 96" fill="none" stroke="#1677ff" stroke-width="2.5" />
      </g>
      <g fill="none" stroke="rgba(250, 84, 28, 0.9)" stroke-width="1.6">
        <circle cx="70" cy="102" r="7" />
        <circle cx="130" cy="102" r="7" />
        <circle cx="190" cy="102" r="7" />
        <circle cx="250" cy="102" r="7" />
      </g>
      <path d="M 190 95 L 190 88 M 190 109 L 190 116 M 183 102 L 176 102 M 197 102 L 204 102" stroke="rgba(250, 84, 28, 0.9)" stroke-width="1.6" />
      <path d="M 84 124 C 88 134 96 138 104 140" fill="none" stroke="#fa541c" stroke-width="2" marker-end="url(#tide-head)" class="tide-arrow" />
      <g font-size="11" font-family='"Microsoft YaHei", "PingFang SC", sans-serif'>
        <text x="16" y="20" fill="rgba(0,0,0,0.65)">风向 →</text>
        <text x="190" y="150" fill="rgba(250,84,28,0.9)" text-anchor="middle" font-weight="600">水质点沿轨道运动（不随波前进）</text>
        <text x="270" y="70" fill="#1677ff" font-weight="600">波形向前传播</text>
        <text x="88" y="128" fill="rgba(0,0,0,0.65)">浅水区轨道变扁、波高增大</text>
      </g>
      <defs>
        <marker id="tide-head" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="rgba(0,0,0,0.55)" />
        </marker>
      </defs>
    </svg>
    <svg v-else viewBox="0 0 340 200" class="tide-svg" role="img" aria-label="潮汐日地月示意">
      <circle cx="322" cy="96" r="14" fill="#faad14" />
      <text x="322" y="130" text-anchor="middle" class="svg-label" fill="rgba(0,0,0,0.65)">太阳</text>
      <ellipse :cx="170" cy="96" rx="66" ry="28" fill="rgba(250, 84, 28, 0.22)" stroke="rgba(250, 84, 28, 0.5)" stroke-dasharray="4 3" />
      <circle cx="170" cy="96" r="22" fill="#1677ff" />
      <circle cx="170" cy="96" r="5" fill="rgba(255,255,255,0.85)" />
      <text x="170" y="150" text-anchor="middle" class="svg-label" fill="rgba(0,0,0,0.65)">地球</text>
      <text x="170" y="52" text-anchor="middle" class="svg-label" fill="rgba(250,84,28,0.9)" font-weight="600">潮汐隆起</text>
      <text x="170" y="164" text-anchor="middle" class="svg-label" fill="rgba(250,84,28,0.9)" font-weight="600">潮汐隆起</text>
      <g>
        <circle cx="288" cy="96" r="4" fill="none" stroke="rgba(114,46,209,0.6)" stroke-dasharray="2 3" />
        <circle :cx="moonX" :cy="moonY" r="9" fill="#595959" />
        <text :x="moonX + 4" :y="moonY - 14" class="svg-label" fill="rgba(0,0,0,0.65)">月球</text>
      </g>
      <line x1="0" y1="96" x2="336" y2="96" stroke="rgba(0,0,0,0.18)" stroke-dasharray="5 5" />
      <text v-if="tideMode === 'spring'" x="16" y="20" class="svg-label" fill="rgba(0,0,0,0.65)">日、月、地一线 → 潮差最大</text>
      <text v-else x="16" y="20" class="svg-label" fill="rgba(0,0,0,0.65)">日、月、地垂直 → 潮差最小</text>
    </svg>
    <a-segmented v-if="tab === 'tide'" v-model:value="tideMode" size="small" :options="[...tideModeOptions]" aria-label="大潮或小潮" />
    <div v-for="fact in tab === 'wave' ? waveFacts : tideFacts" :key="fact" class="fact">· {{ fact }}</div>
  </div>
</template>

<style scoped>
.tide-panel {
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

.tide-svg {
  width: 100%;
  height: auto;
}

.svg-label {
  font-size: 11px;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
}

.wave-move {
  animation: wave-slide 4s linear infinite;
}

@keyframes wave-slide {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-170px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wave-move {
    animation: none;
  }
}

.fact {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 19px;
}
</style>
