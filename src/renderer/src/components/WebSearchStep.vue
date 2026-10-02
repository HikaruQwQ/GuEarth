<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import type { ToolStep } from '@renderer/stores/ai'

const SearchSources = defineAsyncComponent(() => import('./SearchSources.vue'))

const props = defineProps<{ step: ToolStep; busy: boolean; open: boolean }>()
const emit = defineEmits<{ toggle: [keys: string | string[]]; retry: [query: string] }>()
const query = computed(() => typeof props.step.args.query === 'string' ? props.step.args.query : '')
const title = computed(() => `${props.step.status === 'running' ? '正在搜索' : props.step.status === 'ok' ? '已搜索' : '搜索失败'}「${query.value}」`)
const error = computed(() => {
  try {
    const result = JSON.parse(props.step.result)
    return typeof result.error === 'string' ? result.error : props.step.summary
  } catch {
    return props.step.summary
  }
})
</script>

<template>
  <a-collapse ghost class="search-step" :active-key="open ? [step.callId] : []" @change="emit('toggle', $event)">
    <a-collapse-panel :key="step.callId">
      <template #header>
        <span class="search-heading" :class="{ failed: step.status === 'error' }" role="status" aria-live="polite">
          <LoadingOutlined v-if="step.status === 'running'" spin class="search-loading" />
          <CheckCircleOutlined v-else-if="step.status === 'ok'" class="search-success" />
          <CloseCircleOutlined v-else />
          <span class="search-title" :title="title">{{ title }}</span>
        </span>
      </template>
      <a-typography-paragraph class="search-query">{{ query }}</a-typography-paragraph>
      <a-spin v-if="step.status === 'running'" size="small" aria-label="正在获取网页结果" />
      <template v-else-if="step.status === 'error'">
        <a-alert type="error" show-icon :message="error || '搜索失败，请稍后重试'" />
        <a-button class="search-retry" :disabled="busy || !query" @click="emit('retry', query)">重新搜索</a-button>
      </template>
      <SearchSources v-else-if="step.references?.length" :references="step.references" />
      <a-empty v-else description="未找到相关网页">
        <a-button :disabled="busy || !query" @click="emit('retry', query)">重新搜索</a-button>
      </a-empty>
    </a-collapse-panel>
  </a-collapse>
</template>

<style scoped>
.search-step{margin:-4px 0}
.search-step :deep(.ant-collapse-header){padding:4px 0;font-size:12px;line-height:20px}
.search-step :deep(.ant-collapse-header-text){min-width:0;flex:1}
.search-step :deep(.ant-collapse-content-box){padding:4px 0 8px}
.search-heading{display:flex;align-items:center;gap:8px;min-width:0;color:rgba(0,0,0,.65)}
.search-heading :deep(.anticon){flex-shrink:0}
.search-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.search-loading{color:#1677ff}
.search-success{color:#52c41a}
.failed{color:#ff4d4f}
.search-query{font-size:12px;line-height:20px;color:rgba(0,0,0,.65);overflow-wrap:anywhere;margin-bottom:8px}
.search-retry{margin-top:8px}
@media(prefers-reduced-motion:reduce){.search-loading,.search-loading :deep(svg),.search-step :deep(.ant-spin-dot),.search-step :deep(.ant-spin-dot-item){animation:none}}
</style>
