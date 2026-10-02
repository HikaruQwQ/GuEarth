<script setup lang="ts">
import { computed } from 'vue'
import { CloseOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import type { LayerMeta } from '@renderer/stores/globe'

const props = defineProps<{ open: boolean; layers: LayerMeta[]; selectedLayerId: string; error: string; loading: boolean }>()
const emit = defineEmits<{ close: []; select: [id: string]; opacity: [id: string, opacity: number]; retry: [] }>()
const basemaps = computed(() => props.layers.filter((layer) => layer.kind === 'basemap'))
</script>

<template>
  <a-drawer :open="open" placement="right" :width="336" :mask="false" :closable="false" :body-style="{ padding: '16px' }" @close="emit('close')">
    <template #title>
      <div class="panel-title">
        <div><div class="panel-kicker">LAYERS</div><h2>图层管理</h2></div>
        <a-button type="text" aria-label="关闭图层管理" @click="emit('close')"><CloseOutlined /></a-button>
      </div>
    </template>
    <a-alert v-if="error" type="error" show-icon :message="error" class="panel-alert">
      <template #action><a-button type="text" size="small" @click="emit('retry')"><ReloadOutlined />重试</a-button></template>
    </a-alert>
    <a-spin :spinning="loading" class="layer-spin">
      <a-empty v-if="!basemaps.length && !loading" description="暂无可用图层" />
      <div v-else class="layer-section">
        <div class="section-heading"><span>底图</span><a-tag color="blue">{{ basemaps.length }}</a-tag></div>
        <a-list :data-source="basemaps" :split="false" class="layer-list">
          <template #renderItem="{ item }">
            <a-list-item :class="['layer-item', { selected: item.id === selectedLayerId }]">
              <div class="layer-main" @click="emit('select', item.id)">
                <a-radio :checked="item.id === selectedLayerId" :aria-label="`选择${item.name}底图`" />
                <div class="layer-copy"><div class="layer-name">{{ item.name }}</div><div class="layer-description">{{ item.description }}</div></div>
              </div>
              <div class="layer-control"><span>不透明度</span><span>{{ Math.round(item.opacity * 100) }}%</span></div>
              <a-slider :value="item.opacity * 100" :min="0" :max="100" :step="5" :aria-label="`${item.name}不透明度`" @change="(value: number) => emit('opacity', item.id, value / 100)" />
            </a-list-item>
          </template>
        </a-list>
      </div>
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.panel-title{display:flex;align-items:center;justify-content:space-between;width:100%}.panel-kicker{color:rgba(0,0,0,.45);font-size:12px;line-height:20px;letter-spacing:.08em}h2{margin:0;color:rgba(0,0,0,.88);font-size:20px;font-weight:600;line-height:28px}.panel-alert{margin-bottom:16px}.layer-spin{display:block;min-height:168px}.section-heading{display:flex;align-items:center;justify-content:space-between;margin:0 0 8px;color:rgba(0,0,0,.65);font-size:12px;line-height:20px}.layer-list :deep(.ant-list-item){display:block;padding:12px 8px;border-radius:6px}.layer-item.selected{background:rgba(22,119,255,.06)}.layer-main{display:flex;align-items:center;min-height:32px;cursor:pointer}.layer-copy{min-width:0;flex:1}.layer-name{overflow:hidden;color:rgba(0,0,0,.88);font-size:14px;line-height:22px;text-overflow:ellipsis;white-space:nowrap}.layer-description{color:rgba(0,0,0,.45);font-size:12px;line-height:20px}.layer-control{display:flex;justify-content:space-between;margin:8px 0 0 32px;color:rgba(0,0,0,.45);font-size:12px;line-height:20px}.layer-item :deep(.ant-slider){margin:8px 8px 0 32px}
</style>
