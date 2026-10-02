<script setup lang="ts">
import { computed } from 'vue'
import { useClimateStore } from '@renderer/stores/climate'
import { climateZones } from '@renderer/thematic/climateZones'
import { windRampStops } from '@renderer/thematic/windField'

const store = useClimateStore()

const windGradient = computed(() => `linear-gradient(90deg, ${windRampStops.join(', ')})`)
const zoneEntries = climateZones.map((zone) => ({ name: zone.name, color: zone.color }))
</script>

<template>
  <div v-if="store.hasActiveOverlay" class="thematic-legend" aria-label="专题图层图例">
    <div class="legend-title">图例</div>
    <div v-if="store.overlays['wind-particles']" class="legend-group">
      <div class="wind-ramp" :style="{ background: windGradient }"></div>
      <div class="legend-row"><span>风弱</span><span>风强</span></div>
    </div>
    <div v-if="store.overlays['rain-belt']" class="legend-item">
      <span class="swatch" style="background: #1677ff"></span><span>降水雨带</span>
    </div>
    <div v-if="store.overlays['summer-monsoon']" class="legend-item">
      <span class="swatch" style="background: #f5222d"></span><span>夏季风（偏南气流）</span>
    </div>
    <div v-if="store.overlays['winter-monsoon']" class="legend-item">
      <span class="swatch" style="background: #1677ff"></span><span>冬季风（偏北气流）</span>
    </div>
    <div v-if="store.overlays['ocean-currents']" class="legend-group">
      <div class="legend-item"><span class="swatch" style="background: #f5222d"></span><span>暖流</span></div>
      <div class="legend-item"><span class="swatch" style="background: #1677ff"></span><span>寒流</span></div>
    </div>
    <div v-if="store.overlays['climate-zones']" class="legend-group">
      <div v-for="zone in zoneEntries" :key="zone.name" class="legend-item">
        <span class="swatch" :style="{ background: zone.color }"></span><span>{{ zone.name }}</span>
      </div>
    </div>
    <div v-if="store.overlays['coriolis-demo']" class="legend-group">
      <div class="legend-item"><span class="swatch swatch-dashed"></span><span>惯性直线（不偏转）</span></div>
      <div class="legend-item"><span class="swatch" style="background: #1677ff"></span><span>北半球轨迹 · 右偏</span></div>
      <div class="legend-item"><span class="swatch" style="background: #fa8c16"></span><span>南半球轨迹 · 左偏</span></div>
    </div>
  </div>
</template>

<style scoped>
.thematic-legend {
  position: absolute;
  bottom: 80px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 148px;
  max-width: 208px;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
}

.legend-title {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
  margin-bottom: 2px;
}

.legend-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}

.swatch {
  flex: none;
  width: 14px;
  height: 4px;
  border-radius: 2px;
}

.swatch-dashed {
  height: 0;
  border-radius: 0;
  border-top: 2px dashed rgba(0, 0, 0, 0.45);
}

.wind-ramp {
  width: 100%;
  height: 6px;
  border-radius: 3px;
}

.legend-row {
  display: flex;
  justify-content: space-between;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
}
</style>
