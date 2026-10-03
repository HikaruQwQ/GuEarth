<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRightOutlined, CloseOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, FontSizeOutlined, FolderAddOutlined, FolderOutlined, GatewayOutlined, NodeIndexOutlined } from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import type { DataNode, EventDataNode } from 'ant-design-vue/es/tree'
import type { Component } from 'vue'
import type { AnnotationEntry } from '../../../preload'
import { useDrawingStore, type DrawnShape } from '@renderer/stores/drawing'

const props = defineProps<{
  open: boolean
  shapes: DrawnShape[]
  entries: AnnotationEntry[]
  selectedShapeId: string | null
  saveError: string
}>()

const emit = defineEmits<{
  close: []
  edit: [id: string]
  fly: [id: string]
  remove: [id: string]
}>()

const drawingStore = useDrawingStore()
const kindLabels: Record<DrawnShape['kind'], string> = { point: '点', polyline: '线', polygon: '面', arrow: '箭头', text: '文本框' }
const kindIcons: Record<DrawnShape['kind'], Component> = { point: EnvironmentOutlined, polyline: NodeIndexOutlined, polygon: GatewayOutlined, arrow: ArrowRightOutlined, text: FontSizeOutlined }
const folderDialogOpen = ref(false)
const folderDialogMode = ref<'create' | 'rename'>('create')
const folderTargetId = ref<string | null>(null)
const folderName = ref('')
const expandedKeys = ref<string[]>([])
const selectedEntryKey = ref<string | null>(null)
const draggingId = ref<string | null>(null)

const shapesById = computed(() => new Map(props.shapes.map((shape, index) => [shape.id, { shape, index }])))
const treeData = computed<DataNode[]>(() => props.entries.map(toTreeNode))

function toTreeNode(entry: AnnotationEntry): DataNode {
  if (entry.type === 'folder') return {
    key: `folder:${entry.id}`,
    title: entry.name,
    type: 'folder',
    entryId: entry.id,
    children: entry.children.map(toTreeNode)
  }
  const item = shapesById.value.get(entry.id)
  return {
    key: `shape:${entry.id}`,
    title: item?.shape.annotation || `${kindLabels[item?.shape.kind ?? 'point']} ${(item?.index ?? 0) + 1}`,
    type: 'shape',
    entryId: entry.id,
    shapeKind: item?.shape.kind ?? 'point',
    isLeaf: true
  }
}

function openCreate(parentId: string | null): void {
  folderDialogMode.value = 'create'
  folderTargetId.value = parentId
  folderName.value = ''
  folderDialogOpen.value = true
}

function openRename(id: string, name: string): void {
  folderDialogMode.value = 'rename'
  folderTargetId.value = id
  folderName.value = name
  folderDialogOpen.value = true
}

function saveFolder(): void {
  const name = folderName.value.trim()
  if (!name) return
  if (folderDialogMode.value === 'create') {
    const id = drawingStore.addFolder(name, folderTargetId.value)
    if (!id) {
      message.warning('文件夹最多嵌套 5 层')
      return
    }
    expandedKeys.value = [...new Set([...expandedKeys.value, ...(folderTargetId.value ? [`folder:${folderTargetId.value}`] : []), `folder:${id}`])]
  } else if (folderTargetId.value) {
    drawingStore.renameFolder(folderTargetId.value, name)
  }
  folderDialogOpen.value = false
}

function confirmRemoveFolder(id: string, name: string): void {
  Modal.confirm({
    title: `删除文件夹「${name}」？`,
    content: '其中的标注和子文件夹会移到上一级',
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: () => {
      drawingStore.removeFolder(id)
      if (selectedEntryKey.value === `folder:${id}`) selectedEntryKey.value = null
    }
  })
}

function confirmRemoveShape(id: string, name: string): void {
  Modal.confirm({
    title: `删除标注「${name}」？`,
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: () => {
      emit('remove', id)
      if (selectedEntryKey.value === `shape:${id}`) selectedEntryKey.value = null
    }
  })
}

function allowDrop({ dragNode, dropNode, dropPosition }: { dragNode: EventDataNode; dropNode: DataNode; dropPosition: -1 | 0 | 1 }): boolean {
  if (String(dragNode.key) === String(dropNode.key)) return false
  return dropPosition !== 0 || dropNode.type === 'folder'
}

function handleDrop(info: { dragNode: EventDataNode; node: EventDataNode; dropPosition: number; dropToGap: boolean }): void {
  draggingId.value = null
  const sourceKey = String(info.dragNode.key)
  const targetKey = String(info.node.key)
  const sourceId = sourceKey.slice(sourceKey.indexOf(':') + 1)
  const targetId = targetKey.slice(targetKey.indexOf(':') + 1)
  const relativePosition = info.dropPosition - Number(info.node.pos?.split('-').at(-1) ?? 0)
  const placement = !info.dropToGap ? 'inside' : relativePosition < 0 ? 'before' : 'after'
  if (!drawingStore.moveEntry(sourceId, targetId, placement)) {
    message.warning('无法移动到这里，文件夹最多嵌套 5 层')
    return
  }
  if (placement === 'inside') expandedKeys.value = [...new Set([...expandedKeys.value, targetKey])]
}

function handleDragStart(info: { node: EventDataNode }): void {
  const key = String(info.node.key)
  draggingId.value = key.slice(key.indexOf(':') + 1)
}

function dropAtTopLevel(): void {
  if (draggingId.value) drawingStore.moveEntry(draggingId.value, null, 'inside')
  draggingId.value = null
}

function handleSelect(_keys: (string | number)[], info: { node: EventDataNode }): void {
  const key = String(info.node.key)
  selectedEntryKey.value = key
  if (key.startsWith('shape:')) emit('fly', key.slice(6))
}
</script>

<template>
  <a-drawer :open="open" placement="left" :width="380" :mask="false" :closable="false" :body-style="{ padding: '16px', position: 'relative' }" @close="emit('close')">
    <template #title>
      <div class="panel-title">
        <div><div class="panel-kicker">ANNOTATIONS</div><h2>标注</h2></div>
        <a-button type="text" aria-label="关闭标注面板" @click="emit('close')"><CloseOutlined /></a-button>
      </div>
    </template>
    <div class="panel-actions">
      <a-button @click="openCreate(null)"><FolderAddOutlined /> 新建文件夹</a-button>
      <span class="shape-count">{{ shapes.length }} 个标注</span>
    </div>
    <a-alert v-if="saveError" type="error" :message="saveError" show-icon class="save-error" />
    <div v-if="draggingId" class="top-level-drop" @dragover.prevent @drop.prevent="dropAtTopLevel">移至顶层</div>
    <div v-if="entries.length" class="tree-wrap">
    <a-tree
      :tree-data="treeData"
      :selected-keys="selectedEntryKey ? [selectedEntryKey] : selectedShapeId ? [`shape:${selectedShapeId}`] : []"
      :expanded-keys="expandedKeys"
      :allow-drop="allowDrop"
      draggable
      block-node
      class="annotation-tree"
      @expand="(keys: (string | number)[]) => expandedKeys = keys.map(String)"
      @select="handleSelect"
      @dragstart="handleDragStart"
      @dragend="draggingId = null"
      @drop="handleDrop"
    >
      <template #title="{ dataRef }">
        <div v-if="dataRef.type === 'folder'" class="tree-row">
          <FolderOutlined class="row-icon" />
          <span class="row-name" :title="dataRef.title">{{ dataRef.title }}</span>
          <span class="row-actions" :class="{ 'row-actions-visible': selectedEntryKey === dataRef.key }">
            <a-tooltip title="新建子文件夹"><a-button type="text" size="small" class="row-action" :aria-label="`在 ${dataRef.title} 中新建文件夹`" @click.stop="openCreate(dataRef.entryId)"><FolderAddOutlined /></a-button></a-tooltip>
            <a-tooltip title="重命名文件夹"><a-button type="text" size="small" class="row-action" :aria-label="`重命名 ${dataRef.title}`" @click.stop="openRename(dataRef.entryId, dataRef.title)"><EditOutlined /></a-button></a-tooltip>
            <a-tooltip title="删除文件夹"><a-button type="text" size="small" danger class="row-action" :aria-label="`删除 ${dataRef.title}`" @click.stop="confirmRemoveFolder(dataRef.entryId, dataRef.title)"><DeleteOutlined /></a-button></a-tooltip>
          </span>
        </div>
        <div v-else class="tree-row">
          <component :is="kindIcons[dataRef.shapeKind as DrawnShape['kind']]" class="row-icon" />
          <span class="row-name" :title="dataRef.title">{{ dataRef.title }}</span>
          <a-tag class="shape-tag">{{ kindLabels[dataRef.shapeKind as DrawnShape['kind']] }}</a-tag>
          <span class="row-actions" :class="{ 'row-actions-visible': selectedEntryKey === dataRef.key }">
            <a-tooltip title="编辑标注"><a-button type="text" size="small" class="row-action" :aria-label="`编辑 ${dataRef.title}`" @click.stop="emit('edit', dataRef.entryId)"><EditOutlined /></a-button></a-tooltip>
            <a-tooltip title="删除标注"><a-button type="text" size="small" danger class="row-action" :aria-label="`删除 ${dataRef.title}`" @click.stop="confirmRemoveShape(dataRef.entryId, dataRef.title)"><DeleteOutlined /></a-button></a-tooltip>
          </span>
        </div>
      </template>
    </a-tree>
    </div>
    <a-empty v-else description="暂无标注" />
    <a-modal v-model:open="folderDialogOpen" :title="folderDialogMode === 'create' ? '新建文件夹' : '重命名文件夹'" :width="360" ok-text="保存" :ok-button-props="{ disabled: !folderName.trim() }" @ok="saveFolder">
      <a-input v-model:value="folderName" :maxlength="80" placeholder="文件夹名称" @press-enter="saveFolder" />
    </a-modal>
  </a-drawer>
</template>

<style scoped>
.panel-title, .panel-actions, .tree-row { display: flex; align-items: center; }
.panel-title { justify-content: space-between; width: 100%; }
.panel-kicker { color: rgba(0, 0, 0, 0.45); font-size: 12px; line-height: 20px; letter-spacing: 0; }
h2 { margin: 0; color: rgba(0, 0, 0, 0.88); font-size: 20px; font-weight: 600; line-height: 28px; }
.panel-actions { justify-content: space-between; margin-bottom: 16px; }
.shape-count { color: rgba(0, 0, 0, 0.45); font-size: 12px; }
.save-error { margin-bottom: 12px; }
.tree-wrap { margin-left: -8px; margin-right: -8px; }
.tree-wrap :deep(.ant-tree-treenode) { align-items: center; width: 100%; min-width: 0; max-width: 100%; }
.tree-wrap :deep(.ant-tree-switcher) { display: flex; align-items: center; justify-content: center; height: 32px; line-height: 32px; }
.tree-wrap :deep(.ant-tree-node-content-wrapper) { flex: 1; width: 0; min-width: 0; overflow: hidden; }
.tree-wrap :deep(.ant-tree-title) { display: block; width: 100%; min-width: 0; overflow: hidden; }
.top-level-drop { position: absolute; right: 16px; bottom: 16px; left: 16px; z-index: 1; padding: 8px 12px; border: 1px dashed #1677ff; border-radius: 6px; background: #fff; color: #1677ff; text-align: center; font-size: 12px; }
.tree-row { gap: 4px; width: 100%; min-width: 0; height: 32px; }
.row-icon { flex: none; color: rgba(0, 0, 0, 0.45); margin-right: 4px; }
.row-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(0, 0, 0, 0.88); font-size: 14px; }
.row-actions { display: flex; flex: none; align-items: center; visibility: hidden; opacity: 0; transition: opacity 0.2s ease-in-out; }
.tree-row:hover .row-actions, .tree-row:focus-within .row-actions, .row-actions-visible { visibility: visible; opacity: 1; }
.row-action { flex: none; width: 28px; height: 28px; padding: 0; }
.shape-tag { flex: none; margin-right: 0; color: rgba(0, 0, 0, 0.65); background: rgba(0, 0, 0, 0.04); border: none; border-radius: 4px; }
@media (prefers-reduced-motion: reduce) { .row-actions { transition-duration: 0.01ms; } }
</style>
