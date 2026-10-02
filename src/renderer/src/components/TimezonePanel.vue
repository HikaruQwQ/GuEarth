<script setup lang="ts">
import { computed } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import type { TimezoneComparison } from '@renderer/composables/useTimezoneCompare'
import { useSolarStore } from '@renderer/stores/solar'
import { formatClock, localSolarTime } from '@renderer/thematic/solarMath'

const props = defineProps<{ comparison: TimezoneComparison }>()

const emit = defineEmits<{ clear: [] }>()

const solarStore = useSolarStore()

const utcHours = computed(() => {
  if (solarStore.active) return solarStore.utcHour
  const now = new Date()
  return now.getUTCHours() + now.getUTCMinutes() / 60
})

const timeSourceText = computed(() => (solarStore.active ? `按模拟时刻计算（北京 ${solarStore.beijingClock}）` : '按当前真实时刻计算'))

function longitudeText(longitude: number): string {
  return `${Math.abs(longitude).toFixed(1)}°${longitude >= 0 ? 'E' : 'W'}`
}

function pickTime(longitude: number): string {
  return formatClock(localSolarTime(utcHours.value, longitude))
}

const differenceText = computed(() => {
  const difference = props.comparison.differenceHours
  if (Math.abs(difference) < 1 / 60) return '两地经度相近，地方时基本相同'
  const abs = Math.abs(difference)
  const hours = Math.floor(abs)
  const minutes = Math.round((abs - hours) * 60)
  const duration = minutes ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`
  return `B 地比 A 地${difference > 0 ? '早' : '晚'} ${duration}（东早西晚）`
})
</script>

<template>
  <div class="timezone-panel" aria-label="时区对比">
    <div class="panel-header">
      <span class="panel-title">地方时对比</span>
      <a-button type="text" size="small" aria-label="关闭时区对比" @click="emit('clear')">
        <CloseOutlined />
      </a-button>
    </div>
    <div class="pick-row">
      <span class="pick-dot pick-a"></span>
      <span class="pick-name">A 地</span>
      <span class="pick-value">{{ longitudeText(comparison.picks[0].longitude) }}</span>
      <span class="pick-time">{{ pickTime(comparison.picks[0].longitude) }}</span>
    </div>
    <div class="pick-row">
      <span class="pick-dot pick-b"></span>
      <span class="pick-name">B 地</span>
      <span class="pick-value">{{ longitudeText(comparison.picks[1].longitude) }}</span>
      <span class="pick-time">{{ pickTime(comparison.picks[1].longitude) }}</span>
    </div>
    <div class="difference">{{ differenceText }}</div>
    <div class="hint">{{ timeSourceText }}</div>
    <div class="divider"></div>
    <p class="note">地球自西向东自转，同纬度偏东地点先见日出，地方时更早。地方时 = UTC + 经度 ÷ 15。</p>
    <p class="note">日界线有两条：180° 经线为人为日界线（自西向东越过日期减一天）；地方时 0 时所在经线为自然日界线（自西向东越过日期加一天）。</p>
  </div>
</template>

<style scoped>
.timezone-panel {
  position: absolute;
  right: 16px;
  bottom: 80px;
  width: 280px;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  box-shadow: var(--ant-box-shadow-secondary, 0 4px 12px rgba(0, 0, 0, 0.08));
  z-index: 10;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.panel-title {
  color: rgba(0, 0, 0, 0.88);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.pick-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
}

.pick-dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  flex: none;
}

.pick-a {
  background: #1677ff;
}

.pick-b {
  background: #fa8c16;
}

.pick-name {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}

.pick-value {
  margin-left: auto;
  color: rgba(0, 0, 0, 0.88);
  font-size: 13px;
  line-height: 20px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.pick-time {
  min-width: 44px;
  text-align: right;
  color: rgba(0, 0, 0, 0.88);
  font-size: 13px;
  line-height: 20px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.difference {
  color: rgba(0, 0, 0, 0.88);
  font-size: 13px;
  line-height: 22px;
  margin-top: 4px;
}

.hint {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
}

.divider {
  height: 1px;
  background: rgba(5, 5, 5, 0.06);
  margin: 8px 0;
}

.note {
  margin: 0;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}

.note + .note {
  margin-top: 4px;
}
</style>
