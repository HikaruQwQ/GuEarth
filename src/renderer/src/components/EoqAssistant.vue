<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Bubble, Prompts, Sender } from 'ant-design-x-vue'
import { CheckCircleOutlined, ClearOutlined, CloseCircleOutlined, CloseOutlined, CompassOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { useAiStore, type ChatMessage, type ToolStep } from '@renderer/stores/ai'

const store = useAiStore()
const { messages, isStreaming, isPanelOpen, isSettingsOpen } = storeToRefs(store)

const draft = ref('')
const listRef = ref<HTMLDivElement>()

const suggestions = [
  { key: 'erosion', label: '找典型流水侵蚀地貌', description: '讲解成因并带我去看' },
  { key: 'place', label: '珠穆朗玛峰在哪', description: '定位地名并飞行' },
  { key: 'terrain', label: '黄土高原海拔多高', description: '查询地形高程' }
]

const toolLabels: Record<string, string> = {
  search_place: '地点检索',
  fly_to: '视角飞行',
  query_terrain: '地形高程查询',
  get_camera: '获取当前视角'
}

function toolLabel(name: string): string {
  return toolLabels[name] ?? name
}

const reasonTouched = reactive(new Set<string>())
const reasonOpen = reactive(new Set<string>())
const openTools = reactive(new Set<string>())

function reasoningActive(message: ChatMessage): string[] {
  if (reasonTouched.has(message.id)) return reasonOpen.has(message.id) ? ['reasoning'] : []
  return message.status === 'streaming' ? ['reasoning'] : []
}

function toggleReasoning(message: ChatMessage, keys: string | string[]): void {
  reasonTouched.add(message.id)
  if ((Array.isArray(keys) ? keys : [keys]).includes('reasoning')) reasonOpen.add(message.id)
  else reasonOpen.delete(message.id)
}

function openToolKeys(message: ChatMessage): string[] {
  return message.toolSteps.filter((step) => openTools.has(step.callId)).map((step) => step.callId)
}

function onToolChange(message: ChatMessage, keys: string | string[]): void {
  const open = Array.isArray(keys) ? keys : keys ? [keys] : []
  for (const step of message.toolSteps) {
    if (open.includes(step.callId)) openTools.add(step.callId)
    else openTools.delete(step.callId)
  }
}

function prettyInput(step: ToolStep): string {
  const entries = Object.entries(step.args).filter(([, value]) => value !== undefined && value !== '')
  if (!entries.length) return '（无输入）'
  return JSON.stringify(Object.fromEntries(entries), null, 2)
}

function prettyOutput(step: ToolStep): string {
  if (!step.result) return step.status === 'running' ? '执行中…' : '（无输出）'
  try {
    return JSON.stringify(JSON.parse(step.result), null, 2)
  } catch {
    return step.result
  }
}

function submit(value: string | undefined): void {
  const text = (typeof value === 'string' && value.trim() ? value : draft.value).trim()
  if (!text || isStreaming.value) return
  draft.value = ''
  void store.send(text)
}

function handleCancel(): void {
  void store.stop()
}

function handleSuggestion(payload: { data?: { label?: unknown; key?: unknown } }): void {
  const label = typeof payload.data?.label === 'string' ? payload.data.label : ''
  const key = typeof payload.data?.key === 'string' ? payload.data.key : ''
  const text = key === 'place' ? '帮我找珠穆朗玛峰在哪' : label
  if (text) submit(text)
}

watch(
  () => messages.value.map((message) => `${message.content.length}:${message.reasoning.length}:${message.toolSteps.length}:${message.status}`).join(','),
  async () => {
    await nextTick()
    listRef.value?.scrollTo({ top: listRef.value.scrollHeight })
    if (!listRef.value) return
    for (const element of listRef.value.querySelectorAll<HTMLElement>('.reasoning-text')) element.scrollTop = element.scrollHeight
  }
)

watch(
  () => messages.value.length,
  (length) => {
    if (length === 0) {
      reasonTouched.clear()
      reasonOpen.clear()
      openTools.clear()
    }
  }
)
</script>

<template>
  <a-drawer
    :open="isPanelOpen"
    placement="right"
    :width="420"
    :mask="false"
    :closable="false"
    class="eoq-drawer"
    :body-style="{ display: 'flex', flexDirection: 'column', padding: '16px', gap: '12px' }"
    @close="store.setPanelOpen(false)"
  >
    <template #title>
      <div class="panel-title">
        <h2>EOQ 智能助手</h2>
        <div class="title-actions">
          <a-tooltip title="清空对话">
            <a-button type="text" aria-label="清空对话" :disabled="isStreaming || messages.length === 0" @click="store.clearConversation()"><ClearOutlined /></a-button>
          </a-tooltip>
          <a-tooltip title="AI 设置">
            <a-button type="text" aria-label="AI 设置" @click="store.setSettingsOpen(true)"><SettingOutlined /></a-button>
          </a-tooltip>
          <a-button type="text" aria-label="关闭助手" @click="store.setPanelOpen(false)"><CloseOutlined /></a-button>
        </div>
      </div>
    </template>

    <div v-if="messages.length === 0" class="empty-state">
      <CompassOutlined class="empty-icon" />
      <p class="empty-text">我是地理教学助手 EOQ，可以帮你找地名、看地貌、讲成因。</p>
      <p class="empty-hint">地点检索依赖高德 Key 与安全密钥（图层管理 → 供应商密钥），AI 回答依赖下方设置的模型。</p>
      <Prompts :items="suggestions" vertical @item-click="handleSuggestion" />
    </div>

    <div v-else ref="listRef" class="chat-list">
      <template v-for="message in messages" :key="message.id">
        <Bubble v-if="message.role === 'user'" placement="end" :content="message.content" />
        <Bubble v-else placement="start">
          <template #message>
            <div class="assistant-block">
              <a-collapse
                v-if="message.reasoning"
                ghost
                class="reasoning-collapse"
                :active-key="reasoningActive(message)"
                @change="toggleReasoning(message, $event)"
              >
                <a-collapse-panel key="reasoning">
                  <template #header>
                    <span v-if="message.status === 'streaming'" class="shimmer-text">正在深度思考</span>
                    <span v-else class="collapsed-title">已深度思考</span>
                  </template>
                  <div class="reasoning-text">{{ message.reasoning }}</div>
                </a-collapse-panel>
              </a-collapse>
              <a-collapse
                v-if="message.toolSteps.length"
                ghost
                class="tool-collapse"
                :active-key="openToolKeys(message)"
                @change="onToolChange(message, $event)"
              >
                <a-collapse-panel v-for="step in message.toolSteps" :key="step.callId">
                  <template #header>
                    <span v-if="step.status === 'running'" class="shimmer-text">正在使用工具 {{ toolLabel(step.name) }}</span>
                    <span v-else-if="step.status === 'ok'" class="tool-header">
                      <CheckCircleOutlined class="tool-icon-ok" />
                      <span>使用工具 {{ toolLabel(step.name) }}</span>
                      <span v-if="step.summary" class="tool-summary">{{ step.summary }}</span>
                    </span>
                    <span v-else class="tool-header">
                      <CloseCircleOutlined class="tool-icon-error" />
                      <span>使用工具 {{ toolLabel(step.name) }} 失败</span>
                      <span v-if="step.summary" class="tool-summary tool-summary-error">{{ step.summary }}</span>
                    </span>
                  </template>
                  <div class="tool-io">
                    <div class="tool-io-label">输入</div>
                    <pre class="tool-io-body">{{ prettyInput(step) }}</pre>
                    <div class="tool-io-label">输出</div>
                    <pre class="tool-io-body">{{ prettyOutput(step) }}</pre>
                  </div>
                </a-collapse-panel>
              </a-collapse>
              <div v-if="message.content" class="answer-text">{{ message.content }}</div>
              <span v-else-if="message.status === 'streaming' && !message.reasoning && message.toolSteps.length === 0" class="shimmer-text pending-line">思考中…</span>
              <a-alert v-if="message.status === 'error'" type="error" show-icon :message="message.error" class="answer-error" />
            </div>
          </template>
        </Bubble>
      </template>
    </div>

    <Sender
      v-model:value="draft"
      :loading="isStreaming"
      placeholder="问一问地球，例如：帮我找典型的流水侵蚀地貌"
      :submit-type="'enter'"
      @submit="submit"
      @cancel="handleCancel"
    />
  </a-drawer>
</template>

<style scoped>
.panel-title{display:flex;align-items:center;justify-content:space-between;width:100%}
h2{margin:0;color:rgba(0,0,0,.88);font-size:20px;font-weight:600;line-height:28px}
.title-actions{display:flex;align-items:center;gap:4px}
.empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:16px 8px}
.empty-icon{font-size:38px;color:rgba(0,0,0,.25)}
.empty-text{margin:0;color:rgba(0,0,0,.65);font-size:14px;line-height:22px;text-align:center}
.empty-hint{margin:0 0 8px;color:rgba(0,0,0,.45);font-size:12px;line-height:20px;text-align:center}
.chat-list{flex:1;display:flex;flex-direction:column;gap:12px;overflow-y:auto;padding-right:4px}
.assistant-block{display:flex;flex-direction:column;gap:8px;min-width:0}
.reasoning-collapse,.tool-collapse{margin:-4px 0}
.reasoning-collapse :deep(.ant-collapse-header),.tool-collapse :deep(.ant-collapse-header){padding:4px 0;color:rgba(0,0,0,.45);font-size:12px;line-height:20px}
.reasoning-collapse :deep(.ant-collapse-content-box),.tool-collapse :deep(.ant-collapse-content-box){padding:4px 0 8px}
.collapsed-title{color:rgba(0,0,0,.45)}
.reasoning-text{color:rgba(0,0,0,.45);font-size:12px;line-height:20px;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow-y:auto}
.tool-header{display:inline-flex;align-items:center;gap:6px;min-width:0}
.tool-icon-ok{color:#52c41a}
.tool-icon-error{color:#ff4d4f}
.tool-summary{color:rgba(0,0,0,.45);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tool-summary-error{color:#ff4d4f}
.tool-io{display:flex;flex-direction:column;gap:2px}
.tool-io-label{color:rgba(0,0,0,.45);font-size:12px;line-height:20px}
.tool-io-body{margin:0 0 8px;padding:8px;background:#f5f5f5;border-radius:4px;color:rgba(0,0,0,.65);font-family:ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace;font-size:12px;line-height:18px;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto}
.tool-io-body:last-child{margin-bottom:0}
.answer-text{color:rgba(0,0,0,.88);font-size:14px;line-height:22px;white-space:pre-wrap;word-break:break-word}
.pending-line{margin:2px 0}
.answer-error{margin-top:4px}
.shimmer-text{
  display:inline-block;
  font-size:12px;
  line-height:20px;
  background:linear-gradient(90deg,rgba(0,0,0,.25) 25%,rgba(0,0,0,.65) 47%,#1677ff 50%,rgba(0,0,0,.65) 53%,rgba(0,0,0,.25) 75%);
  background-size:200% 100%;
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
  animation:eoq-shimmer 1.5s linear infinite;
}
@keyframes eoq-shimmer{
  0%{background-position:200% 0}
  100%{background-position:-200% 0}
}
@media (prefers-reduced-motion:reduce){
  .shimmer-text{animation:none;background:none;-webkit-background-clip:border-box;background-clip:border-box;color:rgba(0,0,0,.45)}
}
</style>
