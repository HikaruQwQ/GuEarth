<script setup lang="ts">
import { useLegendSections } from '@renderer/utils/legendEntries'

const sections = useLegendSections()
</script>

<template>
  <div v-if="sections.length" class="legend-bar" aria-label="图例">
    <div v-for="section in sections" :key="section.id" class="legend-section">
      <span class="legend-title">{{ section.title }}</span>
      <span v-for="item in section.items" :key="item.label" class="legend-item">
        <span v-if="item.shape === 'dot'" class="swatch dot" :style="{ background: item.color }" />
        <span v-else-if="item.shape === 'fill'" class="swatch fill" :style="{ background: item.color, borderColor: item.color }" />
        <span v-else class="swatch bar" :class="{ dash: item.shape === 'dash', arrow: item.shape === 'arrow' }" :style="{ background: item.shape === 'dash' ? 'transparent' : item.color, borderColor: item.color }">
          <span v-if="item.shape === 'arrow'" class="arrow-head" :style="{ borderLeftColor: item.color }" />
        </span>
        {{ item.label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.legend-bar {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  gap: 16px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  padding: 6px 12px;
  max-width: min(640px, 60vw);
  flex-wrap: wrap;
}

.legend-section {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.legend-title {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
  margin-right: 2px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  line-height: 20px;
}

.swatch {
  flex: none;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 1px rgba(5, 5, 5, 0.15);
}

.fill {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  opacity: 0.75;
  border-width: 1px;
  border-style: solid;
}

.bar {
  position: relative;
  width: 16px;
  height: 4px;
  border-radius: 2px;
}

.bar.dash {
  background: repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 6px);
  color: rgba(0, 0, 0, 0.65);
  height: 0;
  border-top: 2px dashed;
  border-radius: 0;
}

.arrow-head {
  position: absolute;
  right: -5px;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 6px solid;
}
</style>
