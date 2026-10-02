<script setup lang="ts">
import { computed } from 'vue'
import { AimOutlined, AppstoreOutlined, CameraOutlined, ExperimentOutlined, EyeOutlined, HomeOutlined, RobotOutlined, TagsOutlined } from '@ant-design/icons-vue'
import { Button, Tooltip } from 'ant-design-vue'
import type { Component } from 'vue'

const props = defineProps<{
  activePanels: string[]
  levelViewActive: boolean
  levelViewVisible: boolean
}>()

defineEmits<{
  open: [id: string]
  home: []
  toggleLevelView: []
}>()

interface ToolbarEntry {
  id: string
  label: string
  icon: Component
}

const leftEntries: ToolbarEntry[] = [
  { id: 'layers', label: '图层管理', icon: AppstoreOutlined }
]

const centerEntries: ToolbarEntry[] = [
  { id: 'annotations', label: '标注 · 量测 · 导入导出', icon: TagsOutlined },
  { id: 'lab', label: '地理实验室（地形 / 季风 / 昼夜 / 板块 / 天气）', icon: ExperimentOutlined },
  { id: 'export', label: '出图 · 截图', icon: CameraOutlined }
]

const levelViewIcon = computed(() => (props.levelViewActive ? EyeOutlined : AimOutlined))
const levelViewTooltip = computed(() => (props.levelViewActive ? '恢复俯视视角' : '平视 3D 地形'))
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-group">
      <a-tooltip title="回到初始视角" placement="top">
        <a-button type="text" class="toolbar-btn" aria-label="回到初始视角" @click="$emit('home')">
          <HomeOutlined />
        </a-button>
      </a-tooltip>
      <a-tooltip v-for="entry in leftEntries" :key="entry.id" :title="entry.label" placement="top">
        <a-button type="text" class="toolbar-btn" :class="{ active: activePanels.includes(entry.id) }" :aria-label="entry.label" @click="$emit('open', entry.id)">
          <component :is="entry.icon" />
        </a-button>
      </a-tooltip>
    </div>
    <div class="toolbar-group">
      <a-tooltip v-for="entry in centerEntries" :key="entry.id" :title="entry.label" placement="top">
        <a-button type="text" class="toolbar-btn" :class="{ active: activePanels.includes(entry.id) }" :aria-label="entry.label" @click="$emit('open', entry.id)">
          <component :is="entry.icon" />
        </a-button>
      </a-tooltip>
    </div>
    <div class="toolbar-floating">
      <Transition name="fade">
        <Tooltip v-if="levelViewVisible" :title="levelViewTooltip" placement="top">
          <Button
            class="toolbar-circle"
            :type="levelViewActive ? 'primary' : 'default'"
            shape="circle"
            :aria-label="levelViewTooltip"
            @click="$emit('toggleLevelView')"
          >
            <template #icon><component :is="levelViewIcon" /></template>
          </Button>
        </Tooltip>
      </Transition>
      <a-tooltip title="EOQ 智能助手" placement="top">
        <a-button
          type="default"
          shape="circle"
          class="toolbar-circle"
          :class="{ active: activePanels.includes('assistant') }"
          aria-label="EOQ 智能助手"
          @click="$emit('open', 'assistant')"
        >
          <RobotOutlined />
        </a-button>
      </a-tooltip>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  padding: 8px;
  z-index: 100;
}

.toolbar-floating {
  display: flex;
  align-items: center;
  gap: 8px;
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
  font-size: 16px;
}

.toolbar-circle {
  width: 40px;
  height: 40px;
  min-width: 40px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.toolbar-btn:hover {
  background: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.88);
}

.toolbar-btn.active,
.toolbar-btn.active:hover,
.toolbar-circle.active {
  background: #1677ff;
  color: #ffffff;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
