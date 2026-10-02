<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import Sources from '@ant-design/x/es/sources'
import XProvider from '@ant-design/x/es/x-provider'
import type { AiSearchReference } from '../../../preload'

const props = defineProps<{ references: AiSearchReference[] }>()
const host = ref<HTMLDivElement>()
const expanded = ref(true)
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
let root: Root | undefined

function renderSources(): void {
  if (!root) return
  const items = props.references.map((reference) => ({
    key: reference.url,
    url: reference.url,
    title: createElement('span', { className: 'source-item' },
      createElement('span', { className: 'source-item-title' }, reference.title),
      createElement('span', { className: 'source-item-meta' }, [reference.website, reference.date].filter(Boolean).join(' · ')),
      reference.content ? createElement('span', { className: 'source-item-content', title: reference.content }, reference.content) : null
    ),
    description: reference.content
  }))
  root.render(createElement(XProvider, {
    prefixCls: 'gu-search',
    iconPrefixCls: 'gu-search-icon',
    theme: {
      token: {
        colorPrimary: '#1677ff',
        colorText: 'rgba(0,0,0,0.88)',
        colorTextSecondary: 'rgba(0,0,0,0.65)',
        colorTextTertiary: 'rgba(0,0,0,0.45)',
        colorBorderSecondary: 'rgba(5,5,5,0.06)',
        colorBgContainer: '#ffffff',
        fontFamily: "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        fontSize: 14,
        fontWeightStrong: 600,
        borderRadius: 6,
        borderRadiusLG: 8,
        motionDurationFast: '0.1s',
        motionDurationMid: '0.2s',
        motionDurationSlow: '0.3s',
        motion: !reducedMotion.matches
      }
    }
  }, createElement(Sources, {
    prefixCls: 'gu-search-sources',
    title: createElement('button', { type: 'button', className: 'sources-toggle', 'aria-expanded': expanded.value }, `参考来源（${items.length}）`),
    items,
    expanded: expanded.value,
    onExpand: (value: boolean) => { expanded.value = value }
  })))
}

onMounted(() => {
  if (!host.value) return
  root = createRoot(host.value)
  reducedMotion.addEventListener('change', renderSources)
  renderSources()
})
watch([() => props.references, expanded], renderSources, { deep: true, flush: 'post' })
onBeforeUnmount(() => {
  reducedMotion.removeEventListener('change', renderSources)
  root?.unmount()
  root = undefined
})
</script>

<template>
  <div ref="host" class="search-sources" data-search-sources></div>
</template>

<style scoped>
.search-sources{min-width:0;max-width:100%;overflow-wrap:anywhere}
.search-sources :deep(.sources-toggle){appearance:none;background:transparent;border:0;font:inherit;color:inherit;padding:0;min-height:32px;cursor:pointer;text-align:left}
.search-sources :deep(.sources-toggle:focus-visible),.search-sources :deep(a:focus-visible){outline:2px solid #1677ff;outline-offset:2px;border-radius:4px}
.search-sources :deep(.gu-search-sources-list-item){margin-top:8px}
.search-sources :deep(.gu-search-sources-link){display:block;max-width:100%;white-space:normal}
.search-sources :deep(.gu-search-sources-link-title){display:block;white-space:normal}
.search-sources :deep(.source-item){display:flex;flex-direction:column;gap:4px;min-width:0}
.search-sources :deep(.source-item-title){font-size:14px;line-height:22px;overflow-wrap:anywhere}
.search-sources :deep(.source-item-meta){color:rgba(0,0,0,.65);font-size:12px;line-height:20px}
.search-sources :deep(.source-item-content){display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;color:rgba(0,0,0,.65);font-size:12px;line-height:20px}
</style>
