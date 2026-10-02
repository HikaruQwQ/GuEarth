<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ClearOutlined, CloseOutlined, LoadingOutlined, RobotOutlined, SendOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { useAssistantStore } from '@renderer/stores/assistant'

const store = useAssistantStore()
const draft = ref('')
const listEl = ref<HTMLDivElement>()

async function send(): Promise<void> {
  const text = draft.value
  if (!text.trim() || store.busy) return
  draft.value = ''
  await store.send(text)
}

watch(
  () => store.messages.length + (store.messages[store.messages.length - 1]?.content.length ?? 0),
  () => {
    void nextTick(() => listEl.value?.scrollTo({ top: listEl.value.scrollHeight }))
  }
)
</script>

<template>
  <div v-if="store.open" class="assistant-panel">
    <div class="panel-title">
      <div class="title-left">
        <RobotOutlined class="title-icon" />
        <div><div class="panel-kicker">EOQ AGENT</div><h2>智能助手</h2></div>
        <a-tag :color="store.config.configured ? 'green' : 'default'" class="mode-tag">{{ store.config.configured ? store.config.model : '检索模式' }}</a-tag>
      </div>
      <div class="title-actions">
        <a-popover v-model:open="store.settingsOpen" trigger="click" placement="bottomRight">
          <template #content>
            <div class="ai-settings">
              <div class="setting-row"><span>服务地址</span><a-input v-model:value="store.draftBaseUrl" size="small" placeholder="https://api.deepseek.com" /></div>
              <div class="setting-row"><span>模型</span><a-input v-model:value="store.draftModel" size="small" placeholder="deepseek-chat" /></div>
              <div class="setting-row"><span>API Key</span><a-input-password v-model:value="store.draftApiKey" size="small" :placeholder="store.config.configured ? '已保存（留空不变更）' : 'sk-…'" /></div>
              <a-button type="primary" size="small" block :disabled="!store.draftBaseUrl.trim()" @click="store.saveConfig()">保存</a-button>
              <p class="setting-hint">支持 OpenAI 兼容服务（DeepSeek / Qwen / OpenAI 等）。密钥只保存在本机系统加密存储，不进入渲染进程明文。</p>
            </div>
          </template>
          <a-button type="text" size="small" aria-label="AI 设置"><SettingOutlined /></a-button>
        </a-popover>
        <a-button type="text" size="small" aria-label="清空对话" @click="store.clear()"><ClearOutlined /></a-button>
        <a-button type="text" size="small" aria-label="关闭智能助手" @click="store.setOpen(false)"><CloseOutlined /></a-button>
      </div>
    </div>

    <a-alert v-if="store.error" type="warning" :message="store.error" show-icon closable class="assistant-error" @close="store.error = ''" />

    <div ref="listEl" class="assistant-messages">
      <div v-if="!store.messages.length" class="assistant-empty">
        <p>试试这样问我：</p>
        <ul>
          <li>飞到喜马拉雅山脉</li>
          <li>把视野缩放到横断山脉，找海拔 5000 米以上的山峰</li>
          <li>7 月的东亚季风是什么样？</li>
        </ul>
        <p class="empty-hint">{{ store.config.configured ? '助手已连接 AI，可以理解自然语言并驱动地球。' : '未配置 AI 时，仍可直接使用地名搜索与地貌选点。' }}</p>
      </div>
      <div v-for="message in store.messages" :key="message.id" :class="['message', message.role]">
        <div class="bubble">
          <div v-if="message.tools?.length" class="tool-chips">
            <a-tag v-for="chip in message.tools" :key="chip.name" class="tool-chip">{{ chip.name }} · {{ chip.detail }}</a-tag>
          </div>
          <span v-if="message.content" class="content">{{ message.content }}</span>
          <span v-if="message.streaming" class="cursor">▍</span>
          <div v-if="message.result" class="result-list">
            <button v-for="(item, index) in message.result.items" :key="index" type="button" class="result-item" @click="store.focusItem(item)">
              <span class="result-name">{{ item.name }}</span>
              <span class="result-sub">{{ item.subtitle }}</span>
            </button>
            <p v-if="!message.result.items.length" class="result-empty">没有检索到结果</p>
          </div>
        </div>
      </div>
    </div>

    <div class="assistant-input">
      <a-textarea v-model:value="draft" :auto-size="{ minRows: 1, maxRows: 3 }" placeholder="搜索地点、找高峰，或直接提问…" @keydown.enter.exact.prevent="send" />
      <a-button v-if="!store.busy" type="primary" :disabled="!draft.trim()" aria-label="发送" @click="send"><SendOutlined /></a-button>
      <a-button v-else danger aria-label="停止生成" @click="store.stop()"><LoadingOutlined /></a-button>
    </div>
  </div>
</template>

<style scoped>
.assistant-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  bottom: 76px;
  z-index: 95;
  width: 348px;
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
  margin-bottom: 8px;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  color: #1677ff;
  font-size: 18px;
}

.panel-kicker {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 18px;
  letter-spacing: 0.08em;
}

h2 {
  margin: 0;
  color: rgba(0, 0, 0, 0.88);
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
}

.mode-tag {
  flex: none;
}

.title-actions {
  display: flex;
  align-items: center;
}

.assistant-error {
  margin-bottom: 8px;
}

.assistant-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 2px;
}

.assistant-empty {
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
  line-height: 22px;
}

.assistant-empty ul {
  margin: 8px 0;
  padding-left: 18px;
}

.empty-hint {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.message {
  display: flex;
  margin: 8px 0;
}

.message.user {
  justify-content: flex-end;
}

.bubble {
  max-width: 92%;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 22px;
  white-space: pre-wrap;
  word-break: break-word;
}

.message.user .bubble {
  background: rgba(22, 119, 255, 0.08);
  color: rgba(0, 0, 0, 0.88);
}

.message.assistant .bubble {
  background: rgba(0, 0, 0, 0.03);
  color: rgba(0, 0, 0, 0.88);
}

.tool-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.tool-chip {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 11px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.65);
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(5, 5, 5, 0.06);
}

.cursor {
  animation: blink 0.9s steps(1) infinite;
  color: #1677ff;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.result-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  width: 100%;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 6px;
  background: #ffffff;
  padding: 6px 10px;
  cursor: pointer;
  text-align: left;
}

.result-item:hover {
  border-color: #1677ff;
}

.result-name {
  color: rgba(0, 0, 0, 0.88);
  font-size: 13px;
  line-height: 20px;
}

.result-sub {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 18px;
}

.result-empty {
  margin: 0;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.assistant-input {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.assistant-input :deep(.ant-input) {
  resize: none;
}

.ai-settings {
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
}

.setting-row > span {
  flex: none;
  width: 52px;
}

.setting-row :deep(.ant-input) {
  flex: 1;
}

.setting-hint {
  margin: 0;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 18px;
}
</style>
