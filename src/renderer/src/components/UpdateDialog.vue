<script setup lang="ts">
import { useUpdaterStore } from '@renderer/stores/updater'

const store = useUpdaterStore()
</script>

<template>
  <a-modal
    :open="store.promptVisible"
    title="发现可用更新"
    :width="420"
    :closable="false"
    :mask-closable="false"
    :keyboard="false"
    ok-text="立即更新"
    cancel-text="下次提醒"
    @ok="store.startDownload()"
    @cancel="store.remindLater()"
  >
    <div class="update-line">
      <span class="update-label">当前版本</span>
      <span class="update-version">v{{ store.currentVersion }}</span>
    </div>
    <div class="update-line">
      <span class="update-label">最新版本</span>
      <span class="update-version update-version-new">v{{ store.version }}</span>
    </div>
    <p v-if="store.notes" class="update-notes">{{ store.notes }}</p>
  </a-modal>
</template>

<style scoped>
.update-line {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 0;
}

.update-label {
  width: 60px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 14px;
  line-height: 22px;
}

.update-version {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 20px;
  color: rgba(0, 0, 0, 0.88);
}

.update-version-new {
  color: #1677ff;
  font-weight: 600;
}

.update-notes {
  margin: 12px 0 0;
  padding: 8px 12px;
  max-height: 180px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}
</style>
