<script setup lang="ts">
import { computed } from 'vue'
import { useTectonicStore } from '@renderer/stores/tectonic'
import { BOUNDARY_KIND_LABELS, BOUNDARY_COLORS, earthquakeLabel, MAJOR_VOLCANOES, NOTABLE_EARTHQUAKES } from '@renderer/utils/tectonicData'

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
  <div class="tectonic-pane">
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
    <a-tabs size="small" class="point-tabs">
      <a-tab-pane key="volcanoes" :tab="`典型火山（${volcanoCount}）`">
        <div class="point-list">
          <div v-for="volcano in MAJOR_VOLCANOES" :key="volcano.name" class="point-item">
            <span class="point-name">{{ volcano.name }}</span>
            <a-button type="link" size="small" aria-label="定位火山" @click="store.locate('volcano', volcano.name)">定位</a-button>
          </div>
        </div>
      </a-tab-pane>
      <a-tab-pane key="quakes" :tab="`历史大地震（${quakeCount}）`">
        <div class="point-list">
          <div v-for="quake in NOTABLE_EARTHQUAKES" :key="`${quake.name}-${quake.year}`" class="point-item">
            <span class="point-name">{{ earthquakeLabel(quake) }}</span>
            <a-button type="link" size="small" aria-label="定位地震" @click="store.locate('quake', quake.name)">定位</a-button>
          </div>
        </div>
      </a-tab-pane>
    </a-tabs>
    <p class="note">点位大小随震级增大；点击「定位」飞往对应位置。</p>
  </div>
</template>

<style scoped>
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

.point-tabs {
  margin-top: 8px;
}

.point-list {
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.point-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px;
}

.point-name {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 22px;
}

.note {
  margin: 4px 0 0;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
}
</style>
