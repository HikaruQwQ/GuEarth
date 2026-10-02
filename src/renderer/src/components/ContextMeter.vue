<script setup lang="ts">
import { computed, ref } from 'vue'
import { CheckCircleOutlined, CloseCircleOutlined, CompressOutlined, InfoCircleOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import type { AiContextStats } from '../../../preload'
import type { ContextCompressionStatus } from '@renderer/stores/ai'

const props = defineProps<{
  stats: AiContextStats
  status: ContextCompressionStatus
  notice: string
  disabled?: boolean
}>()

const emit = defineEmits<{ compress: [] }>()
const open = ref(false)

const percent = computed(() => Math.min(100, Math.max(0, Math.round(props.stats.usagePercent))))
const tone = computed(() => percent.value >= 80 ? 'error' : percent.value > 70 ? 'warning' : 'normal')
const strokeColor = computed(() => tone.value === 'error' ? '#ff4d4f' : tone.value === 'warning' ? '#faad14' : '#1677ff')
const statusText = computed(() => {
  if (props.status === 'compressing') return '正在压缩上下文...'
  if (props.status === 'error') return '无法压缩上下文'
  return props.notice || `${percent.value}%`
})

function formatTokens(tokens: number): string {
  if (tokens < 1_000) return `${Math.max(0.1, tokens / 1_000).toFixed(1)}k`
  return `${(tokens / 1_000).toFixed(tokens >= 10_000 ? 0 : 1)}k`
}

function compress(): void {
  emit('compress')
}
</script>

<template>
  <a-popover v-model:open="open" trigger="click" placement="topLeft" overlay-class-name="context-popover">
    <template #content>
      <div class="context-card">
        <div class="context-card-title">
          <span>上下文窗口</span>
          <InfoCircleOutlined class="context-info-icon" />
        </div>
        <div class="context-total">
          <span>已有上下文</span>
          <strong>{{ formatTokens(stats.usedTokens) }} / {{ formatTokens(stats.contextWindow) }}</strong>
        </div>
        <a-progress :percent="percent" :stroke-color="strokeColor" :show-info="false" size="small" />
        <div class="context-categories">
          <div v-for="category in stats.categories" :key="category.key" class="context-category">
            <div class="context-category-head">
              <span>{{ category.label }}</span>
              <span>{{ formatTokens(category.tokens) }} · {{ category.ratio }}%</span>
            </div>
            <a-progress :percent="category.ratio" :stroke-color="strokeColor" :show-info="false" size="small" />
          </div>
        </div>
        <a-button type="primary" size="small" block :loading="status === 'compressing'" :disabled="disabled || stats.usedTokens === 0" @click="compress">
          <CompressOutlined />压缩
        </a-button>
      </div>
    </template>
    <button type="button" class="context-meter" :class="`context-meter-${tone}`" :aria-expanded="open" aria-label="查看上下文窗口">
      <span class="context-ring">
        <a-progress type="circle" :percent="percent" :size="24" :stroke-width="14" :stroke-color="strokeColor" :show-info="false" />
      </span>
      <span class="context-status" :class="{ 'shimmer-text': status === 'compressing' }">
        <LoadingOutlined v-if="status === 'compressing'" spin />
        <CloseCircleOutlined v-else-if="status === 'error'" />
        <CheckCircleOutlined v-else-if="notice" />
        <span>{{ statusText }}</span>
      </span>
    </button>
  </a-popover>
</template>

<style scoped>
.context-meter{display:flex;align-items:center;gap:8px;width:100%;min-height:32px;padding:2px 4px;border:0;background:transparent;color:rgba(0,0,0,.65);font:inherit;text-align:left;cursor:pointer}
.context-meter:focus-visible{outline:2px solid #1677ff;outline-offset:2px}
.context-ring{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:0 0 24px;width:24px;height:24px}
.context-ring :deep(.ant-progress){line-height:0}
.context-ring :deep(.ant-progress-inner){display:block}
.context-status{display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden;color:rgba(0,0,0,.45);font-size:12px;line-height:20px;text-overflow:ellipsis;white-space:nowrap}
.context-card{width:304px;max-width:calc(100vw - 48px)}
.context-card-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;color:rgba(0,0,0,.88);font-size:14px;font-weight:600;line-height:22px}
.context-info-icon{color:rgba(0,0,0,.45);font-size:14px}
.context-total,.context-category-head{display:flex;align-items:center;justify-content:space-between;gap:8px;color:rgba(0,0,0,.65);font-size:12px;line-height:20px}
.context-total{margin-bottom:4px}
.context-total strong{color:rgba(0,0,0,.88);font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-weight:400}
.context-categories{display:flex;flex-direction:column;gap:8px;margin:12px 0 16px}
.context-category-head span:last-child{color:rgba(0,0,0,.45);font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace}
.context-card :deep(.ant-progress){margin:0;line-height:1}
.context-card :deep(.ant-btn){height:32px}
.shimmer-text{background:linear-gradient(90deg,rgba(0,0,0,.25) 25%,rgba(0,0,0,.65) 47%,#1677ff 50%,rgba(0,0,0,.65) 53%,rgba(0,0,0,.25) 75%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:context-shimmer 3s linear infinite}
@keyframes context-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.shimmer-text{animation:none;background:none;-webkit-background-clip:border-box;background-clip:border-box;color:rgba(0,0,0,.45)}}
@media (max-width:360px){.context-status{font-size:11px}.context-card{width:calc(100vw - 48px)}}
</style>
