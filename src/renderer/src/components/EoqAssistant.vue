<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import MarkdownIt from 'markdown-it'
import { Bubble, Sender } from 'ant-design-x-vue'
import { CloseCircleOutlined, CloseOutlined, CompassOutlined, DeleteOutlined, HistoryOutlined, LeftOutlined, PlusOutlined, ReloadOutlined, RightOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { useAiStore, toolLabel, type ChatMessage, type ReasoningPart, type ToolStep } from '@renderer/stores/ai'
import type { StoredAiConversation } from '../../../preload'
import ContextMeter from './ContextMeter.vue'
import WebSearchStep from './WebSearchStep.vue'

const store = useAiStore()
const { messages, conversations, currentConversationId, isStreaming, isPanelOpen, isSettingsOpen, contextStats, contextCompressionStatus, contextCompressionNotice } = storeToRefs(store)

const draft = ref('')
const listRef = ref<HTMLDivElement>()
const historyOpen = ref(false)
const deleteConfirmOpen = ref(false)
const deleteTarget = ref<StoredAiConversation | null>(null)
const deleteNoAsk = ref(false)

function formatConversationTime(timestamp: number): string {
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === new Date().toDateString()) return time
  if (date.getFullYear() === new Date().getFullYear()) {
    return `${date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} ${time}`
  }
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

function handleHistoryMenuClick(info: { key: string | number }): void {
  historyOpen.value = false
  store.openConversation(String(info.key))
}

function handleDeleteConversation(event: Event, conversation: StoredAiConversation): void {
  event.stopPropagation()
  historyOpen.value = false
  if (store.settings.skipDeleteConversationConfirm) {
    void store.deleteConversation(conversation.id)
    return
  }
  deleteTarget.value = conversation
  deleteNoAsk.value = false
  deleteConfirmOpen.value = true
}

function confirmDeleteConversation(): void {
  const target = deleteTarget.value
  deleteConfirmOpen.value = false
  deleteTarget.value = null
  if (!target) return
  if (deleteNoAsk.value) store.setSkipDeleteConversationConfirm(true)
  void store.deleteConversation(target.id)
}

const suggestions = [
  { label: '找典型流水侵蚀地貌', description: '讲解成因并带我去看', prompt: '找典型流水侵蚀地貌并讲解成因' },
  { label: '珠穆朗玛峰在哪', description: '定位地名并飞行', prompt: '帮我找珠穆朗玛峰在哪' },
  { label: '黄土高原海拔多高', description: '查询地形高程', prompt: '黄土高原的平均海拔是多少？' },
  { label: '带我去马里亚纳海沟', description: '看看地球最深处', prompt: '带我去马里亚纳海沟看看' },
  { label: '帮我标记秦岭位置', description: '在地球上添加标记', prompt: '帮我标记秦岭的位置' },
  { label: '珠峰和乔戈里峰谁高', description: '对比两座高峰高程', prompt: '珠穆朗玛峰和乔戈里峰哪个更高？' },
  { label: '七彩丹霞怎么形成的', description: '地貌成因解读', prompt: '张掖七彩丹霞是怎么形成的？' },
  { label: '截取当前视角画面', description: '保存地球截图', prompt: '帮我截取当前视角的画面' }
]

const ROTATE_INTERVAL_MS = 4000

const suggestionIndex = ref(0)
const rotatePaused = ref(false)
let rotateTimer: number | undefined
const currentSuggestion = computed(() => suggestions[suggestionIndex.value])

function startRotate(): void {
  if (rotateTimer !== undefined) window.clearInterval(rotateTimer)
  rotateTimer = window.setInterval(() => {
    if (rotatePaused.value) return
    suggestionIndex.value = (suggestionIndex.value + 1) % suggestions.length
  }, ROTATE_INTERVAL_MS)
}

function stopRotate(): void {
  if (rotateTimer === undefined) return
  window.clearInterval(rotateTimer)
  rotateTimer = undefined
}

function stepSuggestion(delta: number): void {
  suggestionIndex.value = (suggestionIndex.value + delta + suggestions.length) % suggestions.length
  startRotate()
}

function submitCurrentSuggestion(): void {
  submit(currentSuggestion.value.prompt)
}

onMounted(startRotate)
onUnmounted(stopRotate)

const md = new MarkdownIt({ breaks: true, linkify: true })
md.validateLink = (url) => /^https?:\/\//i.test(url)
md.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  tokens[index].attrSet('target', '_blank')
  tokens[index].attrSet('rel', 'noopener noreferrer')
  return self.renderToken(tokens, index, options)
}

function renderMarkdown(text: string): string {
  return md.render(text)
}

function reasoningDurationText(part: ReasoningPart): string {
  const seconds = part.ms / 1000
  return seconds < 1 ? '已思考 <1s' : `已思考 ${Math.round(seconds)}s`
}

const reasonTouched = reactive(new Set<string>())
const reasonOpen = reactive(new Set<string>())
const openTools = reactive(new Set<string>())

function isReasoningLive(message: ChatMessage, part: ReasoningPart): boolean {
  return message.status === 'streaming' && message.parts[message.parts.length - 1] === part
}

function reasoningActive(message: ChatMessage, part: ReasoningPart): string[] {
  if (reasonTouched.has(part.id)) return reasonOpen.has(part.id) ? ['reasoning'] : []
  return isReasoningLive(message, part) ? ['reasoning'] : []
}

function toggleReasoning(part: ReasoningPart, keys: string | string[]): void {
  reasonTouched.add(part.id)
  if ((Array.isArray(keys) ? keys : [keys]).includes('reasoning')) reasonOpen.add(part.id)
  else reasonOpen.delete(part.id)
}

function onToolChange(step: ToolStep, keys: string | string[]): void {
  const open = Array.isArray(keys) ? keys : keys ? [keys] : []
  if (open.includes(step.callId)) openTools.add(step.callId)
  else openTools.delete(step.callId)
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

watch(
  () => messages.value.map((message) => `${message.status}:${message.content.length}:${message.parts.map((part) => part.kind === 'reasoning' ? `r${part.text.length}` : part.kind === 'text' ? `t${part.text.length}` : `o${part.step.status}:${part.step.result.length}`).join('.')}`).join(','),
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

watch(currentConversationId, () => {
  reasonTouched.clear()
  reasonOpen.clear()
  openTools.clear()
})
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
          <a-tooltip v-if="messages.length > 0" title="新建会话">
            <a-button type="text" aria-label="新建会话" :disabled="isStreaming" @click="store.newConversation()"><PlusOutlined /></a-button>
          </a-tooltip>
          <a-dropdown v-else v-model:open="historyOpen" :trigger="['click']" placement="bottomRight" :overlay-style="{ width: '300px' }">
            <a-button type="text" aria-label="历史会话" aria-haspopup="menu" :aria-expanded="historyOpen"><HistoryOutlined /></a-button>
            <template #overlay>
              <a-menu class="history-menu" @click="handleHistoryMenuClick">
                <a-menu-item v-if="conversations.length === 0" key="history-empty" disabled class="history-empty">暂无历史会话</a-menu-item>
                <a-menu-item v-for="conversation in conversations" :key="conversation.id" class="history-item" :class="{ 'history-item-active': conversation.id === currentConversationId }">
                  <div class="history-item-body">
                    <span class="history-item-title" :title="conversation.title">{{ conversation.title }}</span>
                    <span class="history-item-time">{{ formatConversationTime(conversation.updatedAt) }}</span>
                    <a-tooltip title="删除会话">
                      <a-button type="text" size="small" danger class="history-delete" :aria-label="`删除会话 ${conversation.title}`" @click="handleDeleteConversation($event, conversation)"><DeleteOutlined /></a-button>
                    </a-tooltip>
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
          <a-tooltip title="AI 设置">
            <a-button type="text" aria-label="AI 设置" @click="store.setSettingsOpen(true)"><SettingOutlined /></a-button>
          </a-tooltip>
          <a-button type="text" aria-label="关闭助手" @click="store.setPanelOpen(false)"><CloseOutlined /></a-button>
        </div>
      </div>
    </template>

    <div v-if="messages.length === 0" class="empty-state">
      <CompassOutlined class="empty-icon" />
      <p class="empty-text">我是地理教学助手，我可以帮你找地方、看地貌、讲成因。</p>
      <div class="suggestion-carousel" @mouseenter="rotatePaused = true" @mouseleave="rotatePaused = false">
        <a-button type="text" shape="circle" size="small" class="suggestion-arrow" aria-label="上一个建议" @click="stepSuggestion(-1)"><LeftOutlined /></a-button>
        <Transition name="suggestion-fade" mode="out-in">
          <button :key="suggestionIndex" type="button" class="suggestion-card" @click="submitCurrentSuggestion">
            <span class="suggestion-label">{{ currentSuggestion.label }}</span>
            <span class="suggestion-desc">{{ currentSuggestion.description }}</span>
          </button>
        </Transition>
        <a-button type="text" shape="circle" size="small" class="suggestion-arrow" aria-label="下一个建议" @click="stepSuggestion(1)"><RightOutlined /></a-button>
      </div>
    </div>

    <div v-else ref="listRef" class="chat-list">
      <template v-for="message in messages" :key="message.id">
        <Bubble v-if="message.role === 'user'" placement="end" :content="message.content" />
        <div v-else class="assistant-block">
          <template v-for="(part, index) in message.parts" :key="`${message.id}-${index}`">
            <a-collapse
              v-if="part.kind === 'reasoning'"
              ghost
              class="reasoning-collapse"
              :active-key="reasoningActive(message, part)"
              @change="toggleReasoning(part, $event)"
            >
              <a-collapse-panel key="reasoning">
                <template #header>
                  <span v-if="isReasoningLive(message, part)" class="shimmer-text">正在深度思考</span>
                  <span v-else class="collapsed-title">{{ reasoningDurationText(part) }}</span>
                </template>
                <div class="reasoning-text">{{ part.text }}</div>
              </a-collapse-panel>
            </a-collapse>
            <div v-else-if="part.kind === 'text'" class="answer-text" v-html="renderMarkdown(part.text)"></div>
            <WebSearchStep
              v-else-if="part.step.name === 'web_search'"
              :step="part.step"
              :busy="isStreaming"
              :open="openTools.has(part.step.callId)"
              @toggle="onToolChange(part.step, $event)"
              @retry="submit(`请重新联网搜索：${$event}`)"
            />
            <a-collapse
              v-else
              ghost
              class="tool-collapse"
              :active-key="openTools.has(part.step.callId) ? [part.step.callId] : []"
              @change="onToolChange(part.step, $event)"
            >
              <a-collapse-panel :key="part.step.callId">
                <template #header>
                  <span v-if="part.step.status === 'running'" class="shimmer-text">{{ toolLabel(part.step.name, true) }}</span>
                  <span v-else-if="part.step.status === 'ok'" class="tool-header">
                    <span class="tool-name">{{ toolLabel(part.step.name) }}</span>
                    <span v-if="part.step.summary" class="tool-summary" :title="part.step.summary">{{ part.step.summary }}</span>
                  </span>
                  <span v-else class="tool-header">
                    <CloseCircleOutlined class="tool-icon-error" />
                    <span class="tool-name">{{ toolLabel(part.step.name) }}</span>
                    <span v-if="part.step.summary" class="tool-summary tool-summary-error" :title="part.step.summary">{{ part.step.summary }}</span>
                  </span>
                </template>
                <div class="tool-io">
                  <div class="tool-io-label">输入</div>
                  <pre class="tool-io-body">{{ prettyInput(part.step) }}</pre>
                  <div class="tool-io-label">输出</div>
                  <pre class="tool-io-body">{{ prettyOutput(part.step) }}</pre>
                </div>
              </a-collapse-panel>
            </a-collapse>
          </template>
          <span v-if="message.status === 'streaming' && message.parts.length === 0" class="shimmer-text pending-line">思考中…</span>
          <a-alert v-if="message.status === 'error'" type="error" show-icon :message="message.error" class="answer-error">
            <template #action>
              <a-button type="text" size="small" :disabled="isStreaming" @click="void store.retryLast()"><ReloadOutlined />重试</a-button>
            </template>
          </a-alert>
        </div>
      </template>
    </div>

    <ContextMeter
      :stats="contextStats"
      :status="contextCompressionStatus"
      :notice="contextCompressionNotice"
      :disabled="isStreaming"
      @compress="void store.compressContext()"
    />
    <Sender
      v-model:value="draft"
      :loading="isStreaming"
      placeholder="问一问地球，例如：帮我找典型的流水侵蚀地貌"
      :submit-type="'enter'"
      @submit="submit"
      @cancel="handleCancel"
    />
    <p class="ai-disclaimer" title="内容由 AI 生成，咕咕地球不为其生成的内容负责，请谨慎甄别">内容由 AI 生成，咕咕地球不为其生成的内容负责，请谨慎甄别</p>
  </a-drawer>

  <a-modal
    v-model:open="deleteConfirmOpen"
    title="删除会话"
    :width="400"
    ok-text="删除"
    :ok-button-props="{ danger: true }"
    cancel-text="取消"
    @ok="confirmDeleteConversation"
  >
    <p class="delete-confirm-text">删除后「{{ deleteTarget?.title }}」将无法恢复。</p>
    <a-checkbox v-model:checked="deleteNoAsk">不再提示</a-checkbox>
  </a-modal>
</template>

<style scoped>
.panel-title{display:flex;align-items:center;justify-content:space-between;width:100%}
h2{margin:0;color:rgba(0,0,0,.88);font-size:20px;font-weight:600;line-height:28px}
.title-actions{display:flex;align-items:center;gap:4px}
.history-menu{max-height:320px;overflow-y:auto}
.history-item :deep(.ant-dropdown-menu-title-content){display:flex;align-items:center;width:100%}
.history-item-active{background:rgba(0,0,0,.04)}
.history-item-body{flex:1;min-width:0;display:flex;align-items:center;gap:4px}
.history-item-title{flex:1;min-width:0;color:rgba(0,0,0,.88);font-size:14px;line-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.history-item-time{flex-shrink:0;color:rgba(0,0,0,.45);font-size:12px;line-height:20px}
.history-delete{flex-shrink:0;height:24px}
.history-empty{color:rgba(0,0,0,.45)}
.delete-confirm-text{margin:0 0 12px;color:rgba(0,0,0,.65);font-size:14px;line-height:22px}
.empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:16px 8px}
.empty-icon{font-size:38px;color:rgba(0,0,0,.25)}
.empty-text{margin:0;color:rgba(0,0,0,.65);font-size:14px;line-height:22px;text-align:center}
.suggestion-carousel{display:flex;align-items:center;gap:2px;width:100%;max-width:340px}
.suggestion-arrow{flex-shrink:0;color:rgba(0,0,0,.45)}
.suggestion-card{flex:1;min-width:0;display:flex;align-items:baseline;justify-content:center;gap:8px;padding:9px 12px;background:#fff;border:1px solid rgba(5,5,5,.12);border-radius:8px;cursor:pointer;font-family:inherit;white-space:nowrap;overflow:hidden;transition:border-color .2s ease,box-shadow .2s ease}
.suggestion-card:hover{border-color:#1677ff;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.suggestion-label{flex-shrink:0;color:rgba(0,0,0,.88);font-size:14px;font-weight:600;line-height:22px}
.suggestion-desc{min-width:0;overflow:hidden;text-overflow:ellipsis;color:rgba(0,0,0,.45);font-size:12px;line-height:20px}
.suggestion-fade-enter-active,.suggestion-fade-leave-active{transition:opacity .2s ease}
.suggestion-fade-enter-from,.suggestion-fade-leave-to{opacity:0}
.empty-hint{margin:0 0 8px;color:rgba(0,0,0,.45);font-size:12px;line-height:20px;text-align:center}
.chat-list{flex:1;display:flex;flex-direction:column;gap:12px;overflow-y:auto;padding-right:4px}
.assistant-block{display:flex;flex-direction:column;gap:8px;min-width:0}
.reasoning-collapse,.tool-collapse{margin:-4px 0}
.reasoning-collapse :deep(.ant-collapse-header),.tool-collapse :deep(.ant-collapse-header){padding:4px 0;color:rgba(0,0,0,.45);font-size:12px;line-height:20px}
.reasoning-collapse :deep(.ant-collapse-content-box),.tool-collapse :deep(.ant-collapse-content-box){padding:4px 0 8px}
.tool-collapse :deep(.ant-collapse-header-text){flex:1;min-width:0;overflow:hidden}
.collapsed-title{color:rgba(0,0,0,.45)}
.reasoning-text{color:rgba(0,0,0,.45);font-size:12px;line-height:20px;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow-y:auto}
.tool-header{display:flex;align-items:center;gap:6px;min-width:0}
.tool-name{flex-shrink:0;white-space:nowrap}
.tool-icon-error{flex-shrink:0;color:#ff4d4f}
.tool-summary{min-width:0;color:rgba(0,0,0,.45);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tool-summary-error{color:#ff4d4f}
.tool-io{display:flex;flex-direction:column;gap:2px}
.tool-io-label{color:rgba(0,0,0,.45);font-size:12px;line-height:20px}
.tool-io-body{margin:0 0 8px;padding:8px;background:#f5f5f5;border-radius:4px;color:rgba(0,0,0,.65);font-family:ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace;font-size:12px;line-height:18px;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto}
.tool-io-body:last-child{margin-bottom:0}
.answer-text{color:rgba(0,0,0,.88);font-size:14px;line-height:22px;word-break:break-word;min-width:0}
.answer-text :deep(p){margin:0 0 8px}
.answer-text :deep(p:last-child){margin-bottom:0}
.answer-text :deep(h1),.answer-text :deep(h2),.answer-text :deep(h3),.answer-text :deep(h4),.answer-text :deep(h5),.answer-text :deep(h6){margin:16px 0 8px;color:rgba(0,0,0,.88);font-weight:600;line-height:24px}
.answer-text :deep(h1){font-size:16px}
.answer-text :deep(h2),.answer-text :deep(h3),.answer-text :deep(h4),.answer-text :deep(h5),.answer-text :deep(h6){font-size:14px}
.answer-text :deep(ul),.answer-text :deep(ol){margin:0 0 8px;padding-left:20px}
.answer-text :deep(li){margin:2px 0}
.answer-text :deep(li>ul),.answer-text :deep(li>ol){margin-bottom:0}
.answer-text :deep(blockquote){margin:0 0 8px;padding:4px 12px;border-left:3px solid rgba(5,5,5,.06);color:rgba(0,0,0,.65)}
.answer-text :deep(blockquote p:last-child){margin-bottom:0}
.answer-text :deep(code){padding:2px 4px;background:rgba(0,0,0,.06);border-radius:4px;font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;line-height:20px}
.answer-text :deep(pre){margin:0 0 8px;padding:12px;background:#f5f5f5;border-radius:6px;overflow-x:auto}
.answer-text :deep(pre code){padding:0;background:none;border-radius:0}
.answer-text :deep(table){display:block;width:max-content;max-width:100%;margin:0 0 8px;overflow-x:auto;border-collapse:collapse}
.answer-text :deep(th),.answer-text :deep(td){padding:4px 8px;border:1px solid rgba(5,5,5,.06)}
.answer-text :deep(th){font-weight:600}
.answer-text :deep(a){color:#1677ff}
.answer-text :deep(hr){margin:12px 0;border:0;border-top:1px solid rgba(5,5,5,.06)}
.answer-text :deep(img){max-width:100%;border-radius:6px}
.pending-line{margin:2px 0}
.ai-disclaimer{margin:-6px 4px 0;color:rgba(0,0,0,.45);font-size:12px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.answer-error{margin-top:4px}
.shimmer-text{
  display:inline-block;
  font-size:12px;
  line-height:20px;
  background:linear-gradient(90deg,rgba(0,0,0,.25) 25%,rgba(0,0,0,.65) 47%,rgba(255,255,255,.95) 50%,rgba(0,0,0,.65) 53%,rgba(0,0,0,.25) 75%);
  background-size:200% 100%;
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
  animation:eoq-shimmer 3s linear infinite;
}
@keyframes eoq-shimmer{
  0%{background-position:200% 0}
  100%{background-position:-200% 0}
}
@media (prefers-reduced-motion:reduce){
  .shimmer-text{animation:none;background:none;-webkit-background-clip:border-box;background-clip:border-box;color:rgba(0,0,0,.45)}
  .suggestion-fade-enter-active,.suggestion-fade-leave-active{transition:none}
}
</style>
