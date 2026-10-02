<script setup lang="ts">
import { computed } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { useTectonicStore } from '@renderer/stores/tectonic'
import { BOUNDARY_KIND_LABELS, BOUNDARY_COLORS, MAJOR_VOLCANOES, NOTABLE_EARTHQUAKES } from '@renderer/utils/tectonicData'

const store = useTectonicStore()

const toggles = computed(() => [
  { key: 'boundaries' as const, label: '板块边界', value: store.showBoundaries },
  { key: 'volcanoes' as const, label: '典型火山', value: store.showVolcanoes },
  { key: 'quakes' as const, label: '典型地震', value: store.showQuakes }
])

const boundaryLegend = computed(() =>
  (Object.keys(BOUNDARY_KIND_LABELS) as Array<keyof typeof BOUNDARY_KIND_LABELS>).map((kind) => ({
    kind,
    label: BOUNDARY_KIND_LABELS[kind],
    color: BOUNDARY_COLORS[kind]
  }))
)

const volcanoCount = MAJOR_VOLCANOES.length
const quakeCount = NOTABLE_EARTHQUAKES.length
</script>

<template>
  <div v-if="store.panelOpen" class="tectonic-panel">
    <div class="panel-title">
      <div><div class="panel-kicker">TECTONICS · VOLCANO · EARTHQUAKE</div><h2>板块构造 · 火山地震</h2></div>
      <a-button type="text" aria-label="关闭板块构造面板" @click="store.setPanelOpen(false)"><CloseOutlined /></a-button>
    </div>
    <div class="legend">
      <span v-for="item in boundaryLegend" :key="item.kind" class="legend-item">
        <span class="legend-swatch" :style="{ background: item.color }"></span>{{ item.label }}
      </span>
    </div>
    <div class="toggle-grid">
      <label v-for="toggle in toggles" :key="toggle.key" class="toggle-item">
        <span>{{ toggle.label }}</span>
        <a-switch size="small" :checked="toggle.value" :aria-label="toggle.label" @change="(value: boolean) => store.toggleShow(toggle.key, value)" />
      </label>
    </div>
    <p class="note">已收录 {{ volcanoCount }} 座典型火山、{{ quakeCount }} 次历史大地震（点位大小随震级增大）。</p>
  </div>
</template>

<style scoped>
.tectonic-panel {
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

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}

.legend-swatch {
  width: 14px;
  height: 4px;
  border-radius: 2px;
}

.toggle-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px 16px;
  margin-top: 8px;
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

.note {
  margin: 8px 0 0;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
}
</style>
