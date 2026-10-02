<script setup lang="ts">
import { AimOutlined, AppstoreOutlined, BorderOuterOutlined, ClearOutlined, CloudOutlined, ColumnWidthOutlined, EnvironmentOutlined, FireOutlined, GatewayOutlined, GlobalOutlined, HomeOutlined, NodeIndexOutlined, RobotOutlined, TagsOutlined } from '@ant-design/icons-vue'
import type { Component } from 'vue'
import type { DrawTool } from '@renderer/stores/drawing'

defineProps<{
  activeTool: DrawTool | null
  shapeCount: number
  activePanels: string[]
}>()

defineEmits<{
  openLayers: []
  openAnnotations: []
  openTerrainLab: []
  openMonsoon: []
  openSolar: []
  openTectonic: []
  openAssistant: []
  home: []
  tool: [tool: DrawTool]
  clearShapes: []
}>()

const tools: { id: DrawTool; label: string; icon: Component }[] = [
  { id: 'point', label: '绘制点', icon: EnvironmentOutlined },
  { id: 'line', label: '绘制线', icon: NodeIndexOutlined },
  { id: 'polygon', label: '绘制多边形', icon: GatewayOutlined },
  { id: 'distance', label: '测量距离', icon: ColumnWidthOutlined },
  { id: 'area', label: '测量面积', icon: BorderOuterOutlined }
]
</script>

<template>
  <div class="toolbar">
    <a-tooltip title="图层管理" placement="right">
      <a-button type="text" :class="['toolbar-btn', { active: activePanels.includes('layers') }]" aria-label="图层管理" @click="$emit('openLayers')">
        <AppstoreOutlined />
      </a-button>
    </a-tooltip>
    <a-tooltip title="标注管理" placement="right">
      <a-button type="text" :class="['toolbar-btn', { active: activePanels.includes('annotations') }]" aria-label="标注管理" @click="$emit('openAnnotations')">
        <TagsOutlined />
      </a-button>
    </a-tooltip>
    <a-tooltip title="地形实验室（框选区域生成 3D 地形与剖面）" placement="right">
      <a-button type="text" :class="['toolbar-btn', { active: activePanels.includes('terrain') }]" aria-label="地形实验室" @click="$emit('openTerrainLab')">
        <AimOutlined />
      </a-button>
    </a-tooltip>
    <a-tooltip title="季风 · 洋流 · 气候（随月份联动）" placement="right">
      <a-button type="text" :class="['toolbar-btn', { active: activePanels.includes('monsoon') }]" aria-label="季风洋流气候" @click="$emit('openMonsoon')">
        <CloudOutlined />
      </a-button>
    </a-tooltip>
    <a-tooltip title="昼夜光照 · 晨昏线（日期时刻模拟）" placement="right">
      <a-button type="text" :class="['toolbar-btn', { active: activePanels.includes('solar') }]" aria-label="昼夜光照晨昏线" @click="$emit('openSolar')">
        <GlobalOutlined />
      </a-button>
    </a-tooltip>
    <a-tooltip title="板块构造 · 火山地震" placement="right">
      <a-button type="text" :class="['toolbar-btn', { active: activePanels.includes('tectonic') }]" aria-label="板块构造火山地震" @click="$emit('openTectonic')">
        <FireOutlined />
      </a-button>
    </a-tooltip>
    <a-tooltip title="回到初始视角" placement="right">
      <a-button type="text" class="toolbar-btn" aria-label="回到初始视角" @click="$emit('home')">
        <HomeOutlined />
      </a-button>
    </a-tooltip>
    <a-tooltip title="EOQ 智能助手" placement="right">
      <a-button type="text" :class="['toolbar-btn', { active: activePanels.includes('assistant') }]" aria-label="EOQ 智能助手" @click="$emit('openAssistant')">
        <RobotOutlined />
      </a-button>
    </a-tooltip>
    <div class="toolbar-divider"></div>
    <a-tooltip v-for="item in tools" :key="item.id" :title="item.label" placement="right">
      <a-button type="text" class="toolbar-btn" :class="{ active: activeTool === item.id }" :aria-label="item.label" @click="$emit('tool', item.id)">
        <component :is="item.icon" />
      </a-button>
    </a-tooltip>
    <div class="toolbar-divider"></div>
    <a-tooltip title="清除全部标注" placement="right">
      <a-button type="text" class="toolbar-btn" :disabled="!shapeCount" aria-label="清除全部标注" @click="$emit('clearShapes')">
        <ClearOutlined />
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
