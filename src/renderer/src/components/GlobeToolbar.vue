<script setup lang="ts">
import { AppstoreOutlined, HomeOutlined } from '@ant-design/icons-vue'

defineEmits<{
  openLayers: []
  home: []
}>()
</script>

<template>
  <div class="toolbar">
    <a-tooltip title="图层管理" placement="right">
      <a-button type="text" class="toolbar-btn" aria-label="图层管理" @click="$emit('openLayers')">
        <AppstoreOutlined />
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
</style>
