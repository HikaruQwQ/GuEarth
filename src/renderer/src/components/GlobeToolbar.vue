<script setup lang="ts">
import { AppstoreOutlined, CameraOutlined, ExperimentOutlined, HomeOutlined, RobotOutlined, TagsOutlined } from '@ant-design/icons-vue'
import type { Component } from 'vue'

defineProps<{
  activePanels: string[]
}>()

defineEmits<{
  open: [id: string]
  home: []
}>()

interface ToolbarEntry {
  id: string
  label: string
  icon: Component
}

const entries: ToolbarEntry[] = [
  { id: 'layers', label: '图层管理', icon: AppstoreOutlined },
  { id: 'annotations', label: '标注 · 量测 · 导入导出', icon: TagsOutlined },
  { id: 'lab', label: '地理实验室（地形 / 季风 / 昼夜 / 板块 / 天气）', icon: ExperimentOutlined },
  { id: 'export', label: '出图 · 截图', icon: CameraOutlined },
  { id: 'assistant', label: 'EOQ 智能助手', icon: RobotOutlined }
]
</script>

<template>
  <div class="toolbar">
    <a-tooltip v-for="entry in entries" :key="entry.id" :title="entry.label" placement="right">
      <a-button
        type="text"
        :class="['toolbar-btn', { active: activePanels.includes(entry.id) }]"
        :aria-label="entry.label"
        @click="$emit('open', entry.id)"
      >
        <component :is="entry.icon" />
      </a-button>
    </a-tooltip>
    <div class="toolbar-divider"></div>
    <a-tooltip title="回到初始视角" placement="right">
      <a-button type="text" class="toolbar-btn" aria-label="回到初始视角" @click="$emit('home')">
        <HomeOutlined />
      </a-button>
    </a-tooltip>
  </div>
</template>

<style scoped>
.toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  padding: 8px;
  z-index: 100;
}

.toolbar-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.65);
  border-radius: 4px;
}

.toolbar-btn:hover {
  background: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.88);
}

.toolbar-btn.active,
.toolbar-btn.active:hover {
  background: #1677ff;
  color: #ffffff;
}

.toolbar-divider {
  height: 1px;
  margin: 0 4px;
  background: rgba(5, 5, 5, 0.06);
}
</style>
