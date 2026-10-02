<script setup lang="ts">
import { AimOutlined, CloseOutlined, DeleteOutlined, EnvironmentOutlined, GatewayOutlined, NodeIndexOutlined } from '@ant-design/icons-vue'
import type { Component } from 'vue'
import type { DrawnShape } from '@renderer/stores/drawing'

defineProps<{
  open: boolean
  shapes: DrawnShape[]
  selectedShapeId: string | null
}>()

const emit = defineEmits<{
  close: []
  select: [id: string]
  fly: [id: string]
  remove: [id: string]
}>()

const kindLabels: Record<DrawnShape['kind'], string> = { point: '点', polyline: '线', polygon: '面' }
const kindIcons: Record<DrawnShape['kind'], Component> = { point: EnvironmentOutlined, polyline: NodeIndexOutlined, polygon: GatewayOutlined }

function kindLabel(kind: DrawnShape['kind']): string {
  return kindLabels[kind]
}

function kindIcon(kind: DrawnShape['kind']): Component {
  return kindIcons[kind]
}

function displayName(shape: DrawnShape, index: number): string {
  return shape.annotation || `${kindLabels[shape.kind]} ${index + 1}`
}
</script>

<template>
  <a-drawer :open="open" placement="left" :width="320" :mask="false" :closable="false" :body-style="{ padding: '16px' }" @close="emit('close')">
    <template #title>
      <div class="panel-title">
        <div><div class="panel-kicker">ANNOTATIONS</div><h2>标注</h2></div>
        <a-button type="text" aria-label="关闭标注面板" @click="emit('close')"><CloseOutlined /></a-button>
      </div>
    </template>
    <a-empty v-if="!shapes.length" description="暂无标注" />
    <a-list v-else :data-source="shapes" :split="false" class="shape-list">
      <template #renderItem="{ item, index }">
        <a-list-item :class="['shape-item', { selected: item.id === selectedShapeId }]" @click="emit('select', item.id)">
          <component :is="kindIcon(item.kind)" class="shape-icon" />
          <span class="shape-name">{{ displayName(item, Number(index)) }}</span>
          <a-tag class="shape-tag">{{ kindLabel(item.kind) }}</a-tag>
          <a-button type="text" size="small" class="shape-action" aria-label="定位标注" @click.stop="emit('fly', item.id)"><AimOutlined /></a-button>
          <a-button type="text" size="small" danger class="shape-action" aria-label="删除标注" @click.stop="emit('remove', item.id)"><DeleteOutlined /></a-button>
        </a-list-item>
      </template>
    </a-list>
  </a-drawer>
</template>

<style scoped>
.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.panel-kicker {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
  letter-spacing: 0.08em;
}

h2 {
  margin: 0;
  color: rgba(0, 0, 0, 0.88);
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.shape-list :deep(.ant-list-item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
}

.shape-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.shape-item.selected {
  background: rgba(22, 119, 255, 0.06);
}

.shape-icon {
  color: rgba(0, 0, 0, 0.45);
}

.shape-name {
  flex: 1;
  overflow: hidden;
  color: rgba(0, 0, 0, 0.88);
  font-size: 14px;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shape-tag {
  margin-right: 0;
  color: rgba(0, 0, 0, 0.65);
  background: rgba(0, 0, 0, 0.04);
  border: none;
  border-radius: 4px;
}

.shape-action {
  flex: none;
}
</style>
