<script setup lang="ts">
import { computed } from 'vue'
import { AimOutlined, CloseOutlined, EditOutlined, NodeIndexOutlined, TableOutlined } from '@ant-design/icons-vue'
import { useDrawStore, type DrawMode } from '@renderer/stores/draw'
import { useGlobeStore } from '@renderer/stores/globe'
import { formatAreaKm2 } from '@renderer/utils/measure'

const store = useDrawStore()
const globeStore = useGlobeStore()

const modes = computed(() => [
  { key: 'none' as DrawMode, label: '浏览', icon: AimOutlined },
  { key: 'point' as DrawMode, label: '标注点', icon: NodeIndexOutlined },
  { key: 'line' as DrawMode, label: '测距', icon: EditOutlined },
  { key: 'polygon' as DrawMode, label: '量面积', icon: TableOutlined }
])

const modeHint = computed(() => {
  if (store.mode === 'point') return '在地球上点击放置标注点'
  if (store.mode === 'line') return '左键逐点连线，右键或双击结束，Esc 取消'
  if (store.mode === 'polygon') return '左键逐点圈画，右键或双击结束，Esc 取消'
  return '选择一种工具开始在地球上绘制'
})

function formatMeasure(item: { kind: string; distanceKm: number | null; areaKm2: number | null }): string {
  if (item.kind === 'line' && item.distanceKm !== null) return `${item.distanceKm < 100 ? item.distanceKm.toFixed(1) : Math.round(item.distanceKm).toLocaleString()} km`
  if (item.kind === 'polygon' && item.areaKm2 !== null) return formatAreaKm2(item.areaKm2)
  return '标注点'
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

async function handleRemove(id: string): Promise<void> {
  try {
    await store.removeAnnotation(id)
  } catch (cause) {
    globeStore.setGlobeError(cause instanceof Error ? cause.message : '删除失败')
  }
}

function handleLocate(points: Array<[number, number]>, kind: 'point' | 'line' | 'polygon'): void {
  store.locate(points, kind)
}
</script>

<template>
  <div v-if="store.panelOpen" class="draw-panel">
    <div class="panel-title">
      <div><div class="panel-kicker">DRAW · MEASURE · ANNOTATE</div><h2>教学标注 · 量测</h2></div>
      <a-button type="text" aria-label="关闭标注面板" @click="store.setPanelOpen(false)"><CloseOutlined /></a-button>
    </div>
    <div class="mode-row">
      <a-button v-for="item in modes" :key="item.key" size="small" :type="store.mode === item.key ? 'primary' : 'default'" :aria-label="item.label" @click="store.setMode(item.key)">
        <component :is="item.icon" /><span class="mode-label">{{ item.label }}</span>
      </a-button>
    </div>
    <p class="mode-hint">{{ modeHint }}</p>
    <div class="annotation-list">
      <a-empty v-if="!store.annotations.length" description="还没有标注，选择工具在地球上绘制" />
      <div v-for="item in store.annotations" :key="item.id" class="annotation-item">
        <div class="annotation-main">
          <span class="annotation-name">{{ item.name }}</span>
          <span class="annotation-measure">{{ formatMeasure(item) }}</span>
          <span class="annotation-date">{{ formatDate(item.createdAt) }}</span>
        </div>
        <div class="annotation-actions">
          <a-button type="link" size="small" aria-label="定位标注" @click="handleLocate(item.points, item.kind)">定位</a-button>
          <a-button type="link" size="small" danger aria-label="删除标注" @click="handleRemove(item.id)">删除</a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.draw-panel {
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

.mode-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.mode-label {
  margin-left: 4px;
}

.mode-hint {
  margin: 6px 0 8px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}

.annotation-list {
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.annotation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 6px;
}

.annotation-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.annotation-name {
  color: rgba(0, 0, 0, 0.88);
  font-size: 13px;
  line-height: 22px;
  white-space: nowrap;
}

.annotation-measure {
  color: #1677ff;
  font-size: 12px;
  line-height: 20px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.annotation-date {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
}

.annotation-actions {
  flex: none;
  display: flex;
  align-items: center;
}
</style>
