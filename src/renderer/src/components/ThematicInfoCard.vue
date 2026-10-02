<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { CloseOutlined, InfoCircleOutlined, RobotOutlined } from '@ant-design/icons-vue'
import { useAiStore } from '@renderer/stores/ai'
import { useFeatureFocusStore } from '@renderer/stores/featureFocus'
import { useGlobeStore } from '@renderer/stores/globe'

const focusStore = useFeatureFocusStore()
const aiStore = useAiStore()
const globeStore = useGlobeStore()
const { isLayerPanelOpen } = storeToRefs(globeStore)

function explainWithAi(): void {
  const feature = focusStore.focused
  if (!feature) return
  aiStore.setPanelOpen(true)
  void aiStore.send(`请结合「${feature.layerName}」图层，讲解${feature.name}的成因、分布规律及其对地理环境的影响。参考信息：${feature.summary}`)
}
</script>

<template>
  <div v-if="focusStore.focused && isLayerPanelOpen" class="occlusion-hint" role="status">
    <InfoCircleOutlined />
    <span>成因讲解卡片被图层面板遮挡，关闭面板后即可查看</span>
    <a-button type="link" size="small" @click="globeStore.setLayerPanelOpen(false)">关闭面板</a-button>
  </div>
  <div v-if="focusStore.focused" class="feature-card" role="status" aria-label="专题要素信息">
    <div class="card-head">
      <a-tag class="card-tag">{{ focusStore.focused.layerName }}</a-tag>
      <a-button type="text" size="small" aria-label="关闭" @click="focusStore.clearFocus()"><CloseOutlined /></a-button>
    </div>
    <h3 class="card-title">{{ focusStore.focused.name }}</h3>
    <p class="card-summary">{{ focusStore.focused.summary }}</p>
    <a-button type="primary" size="small" block @click="explainWithAi"><RobotOutlined />让 AI 讲解成因</a-button>
  </div>
</template>

<style scoped>
.occlusion-hint {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  white-space: nowrap;
  z-index: 1001;
}

.feature-card {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 296px;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  z-index: 10;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-tag {
  margin-right: 0;
}

.card-title {
  margin: 4px 0 6px;
  color: rgba(0, 0, 0, 0.88);
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.card-summary {
  max-height: 168px;
  overflow-y: auto;
  margin: 0 0 12px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}
</style>
