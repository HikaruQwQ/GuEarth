<script setup lang="ts">
import { computed } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { useClimateStore } from '@renderer/stores/climate'
import { ensoPhaseMeta, ensoPhaseOptions, type EnsoPhase } from '@renderer/thematic/ensoPhases'

const emit = defineEmits<{ close: [] }>()
const store = useClimateStore()

const phase = computed<EnsoPhase>(() => store.ensoPhase)
const meta = computed(() => ensoPhaseMeta[phase.value])

function selectPhase(value: EnsoPhase): void {
  store.setEnsoPhase(value)
}
</script>

<template>
  <div class="enso-panel" role="group" aria-label="ENSO 演示">
    <div class="panel-header">
      <span class="panel-title">ENSO：厄尔尼诺与拉尼娜</span>
      <a-button type="text" size="small" aria-label="关闭 ENSO 演示" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </div>
    <a-segmented :value="phase" :options="[...ensoPhaseOptions]" size="small" @change="(value: string | number) => selectPhase(value as EnsoPhase)" aria-label="ENSO 相位" />
    <div class="phase-summary">{{ meta.summary }}</div>
    <div class="walker-line">
      <span class="section-title">沃克环流变化</span>
      {{ meta.walker }}
    </div>
    <div class="section-title">对地理格局的主要影响</div>
    <div v-for="impact in meta.impacts" :key="impact" class="impact-item">· {{ impact }}</div>
    <div class="panel-note">在地球上：沿赤道的着色带为海温距平（红=偏暖、蓝=偏冷），紫色框为 Niño3.4 关键监测区，太平洋上空的叠加图为沃克环流剖面。点击着色带可查看讲解。</div>
  </div>
</template>

<style scoped>
.enso-panel {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 380px;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
  padding: 12px 16px 16px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  box-shadow: var(--ant-box-shadow-secondary, 0 4px 12px rgba(0, 0, 0, 0.08));
  z-index: 10;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title {
  margin-right: auto;
  color: rgba(0, 0, 0, 0.88);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.phase-summary,
.walker-line {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}

.walker-line {
  background: rgba(114, 46, 209, 0.06);
  border-radius: 6px;
  padding: 8px 10px;
}

.section-title {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.impact-item {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 19px;
}

.panel-note {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 19px;
}
</style>
