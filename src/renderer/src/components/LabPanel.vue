<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { CloseOutlined } from '@ant-design/icons-vue'
import { useLabStore } from '@renderer/stores/lab'
import TerrainLabPanel from '@renderer/components/TerrainLabPanel.vue'
import MonsoonPanel from '@renderer/components/MonsoonPanel.vue'
import SolarPanel from '@renderer/components/SolarPanel.vue'
import TectonicPanel from '@renderer/components/TectonicPanel.vue'
import WeatherPanel from '@renderer/components/WeatherPanel.vue'

const store = useLabStore()
const { panelOpen, activeTab } = storeToRefs(store)
</script>

<template>
  <div v-if="panelOpen" class="lab-panel">
    <div class="panel-title">
      <div><div class="panel-kicker">GEOGRAPHY LAB</div><h2>地理实验室</h2></div>
      <a-button type="text" aria-label="关闭地理实验室" @click="store.setPanelOpen(false)"><CloseOutlined /></a-button>
    </div>
    <a-tabs :active-key="activeTab" size="small" class="lab-tabs" @change="(key: string | number) => store.setActiveTab(key as typeof activeTab)">
      <a-tab-pane key="terrain" tab="地形">
        <TerrainLabPanel />
      </a-tab-pane>
      <a-tab-pane key="monsoon" tab="季风 · 洋流">
        <MonsoonPanel />
      </a-tab-pane>
      <a-tab-pane key="solar" tab="昼夜光照">
        <SolarPanel />
      </a-tab-pane>
      <a-tab-pane key="tectonic" tab="板块构造">
        <TectonicPanel />
      </a-tab-pane>
      <a-tab-pane key="weather" tab="天气系统">
        <WeatherPanel />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped>
.lab-panel {
  position: absolute;
  left: 76px;
  top: 16px;
  z-index: 90;
  width: 430px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
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
  flex: none;
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

.lab-tabs {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.lab-tabs :deep(.ant-tabs-content-holder) {
  overflow-y: auto;
  min-height: 0;
}

.lab-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 8px;
}
</style>
