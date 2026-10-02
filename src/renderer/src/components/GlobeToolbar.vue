<script setup lang="ts">
import { AimOutlined, AppstoreOutlined, CloudOutlined, FireOutlined, GlobalOutlined, HomeOutlined, RobotOutlined } from '@ant-design/icons-vue'

defineProps<{
  active: string[]
}>()

defineEmits<{
  openLayers: []
  openTerrainLab: []
  openMonsoon: []
  openSolar: []
  openTectonic: []
  openAssistant: []
  home: []
}>()
</script>

<template>
  <div class="toolbar">
    <a-tooltip title="图层管理" placement="right">
      <a-button type="text" :class="['toolbar-btn', { active: active.includes('layers') }]" aria-label="图层管理" @click="$emit('openLayers')">
        <AppstoreOutlined />
      </a-button>
    </a-tooltip>
    <a-tooltip title="地形实验室（框选区域生成 3D 地形与剖面）" placement="right">
      <a-button type="text" :class="['toolbar-btn', { active: active.includes('terrain') }]" aria-label="地形实验室" @click="$emit('openTerrainLab')">
        <AimOutlined />
      </a-button>
    </a-tooltip>
    <a-tooltip title="季风 · 洋流 · 气候（随月份联动）" placement="right">
      <a-button type="text" :class="['toolbar-btn', { active: active.includes('monsoon') }]" aria-label="季风洋流气候" @click="$emit('openMonsoon')">
        <CloudOutlined />
      </a-button>
    </a-tooltip>
    <a-tooltip title="昼夜光照 · 晨昏线（日期时刻模拟）" placement="right">
      <a-button type="text" :class="['toolbar-btn', { active: active.includes('solar') }]" aria-label="昼夜光照晨昏线" @click="$emit('openSolar')">
        <GlobalOutlined />
      </a-button>
    </a-tooltip>
    <a-tooltip title="板块构造 · 火山地震" placement="right">
      <a-button type="text" :class="['toolbar-btn', { active: active.includes('tectonic') }]" aria-label="板块构造火山地震" @click="$emit('openTectonic')">
        <FireOutlined />
      </a-button>
    </a-tooltip>
    <a-tooltip title="智能助手（搜索地点 / 地貌选点）" placement="right">
      <a-button type="text" :class="['toolbar-btn', { active: active.includes('assistant') }]" aria-label="智能助手" @click="$emit('openAssistant')">
        <RobotOutlined />
      </a-button>
    </a-tooltip>
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

.toolbar-btn.active {
  background: #1677ff;
  color: #ffffff;
}

.toolbar-btn.active:hover {
  background: #4096ff;
  color: #ffffff;
}
</style>
