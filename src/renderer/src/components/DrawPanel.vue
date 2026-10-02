<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AimOutlined,
  BgColorsOutlined,
  CloseOutlined,
  CompassOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  ExportOutlined,
  ImportOutlined,
  NodeIndexOutlined,
  PictureOutlined,
  TableOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { useDrawStore, type DrawMode } from '@renderer/stores/draw'
import { useGlobeStore } from '@renderer/stores/globe'
import { bearingText, formatAreaKm2 } from '@renderer/utils/measure'
import { SAMPLE_DATASETS } from '@renderer/utils/sampleDatasets'
import type { AnnotationData, AnnotationIcon, AnnotationStyle } from '../../../preload/types'

const store = useDrawStore()
const globeStore = useGlobeStore()

const PALETTE = ['#1677ff', '#13c2c2', '#52c41a', '#7cb305', '#faad14', '#fa8c16', '#fa541c', '#f5222d', '#eb2f96', '#722ed1', '#2f54eb', '#595959']
const ICON_OPTIONS: Array<{ value: AnnotationIcon; label: string }> = [
  { value: 'circle', label: '圆点' },
  { value: 'triangle', label: '三角' },
  { value: 'star', label: '星形' },
  { value: 'pin', label: '图钉' }
]

const modes = computed(() => [
  { key: 'none' as DrawMode, label: '浏览', icon: AimOutlined },
  { key: 'point' as DrawMode, label: '标注点', icon: NodeIndexOutlined },
  { key: 'line' as DrawMode, label: '测距', icon: EditOutlined },
  { key: 'polygon' as DrawMode, label: '量面积', icon: TableOutlined },
  { key: 'pick' as DrawMode, label: '拾取坐标', icon: CompassOutlined }
])

const modeHint = computed(() => {
  if (store.mode === 'point') return '在地球上点击放置标注点'
  if (store.mode === 'line') return '左键逐点连线，右键或双击结束，Esc 取消'
  if (store.mode === 'polygon') return '左键逐点圈画，右键或双击结束，Esc 取消'
  if (store.mode === 'pick') return '在地球上点击任意位置，读出经纬度（度分秒）与海拔'
  return '选择一种工具开始在地球上绘制，或将 KML / KMZ / GPX 文件拖入窗口'
})

const styleEditing = ref<AnnotationData | null>(null)
const renamingId = ref('')
const renameValue = ref('')
const groupCollapse = ref<string[]>([])

const groupedAnnotations = computed(() => {
  const grouped = new Map<string, AnnotationData[]>()
  for (const annotation of store.annotations) {
    const key = annotation.groupId ?? ''
    grouped.set(key, [...(grouped.get(key) ?? []), annotation])
  }
  return grouped
})

const visibleGroups = computed(() => {
  const grouped = groupedAnnotations.value
  return [
    ...store.groups.map((group) => ({ group, items: grouped.get(group.id) ?? [] })),
    ...(grouped.has('') ? [{ group: null, items: grouped.get('') ?? [] }] : [])
  ]
})

const groupVisibility = (items: AnnotationData[]): boolean | 'indeterminate' => {
  const shown = items.filter((item) => item.visible).length
  if (shown === 0) return false
  return shown === items.length ? true : 'indeterminate'
}

function formatMeasure(item: { kind: string; distanceKm: number | null; areaKm2: number | null; points: Array<[number, number]> }): string {
  if (item.kind === 'line' && item.distanceKm !== null) {
    const distance = item.distanceKm < 100 ? `${item.distanceKm.toFixed(1)} km` : `${Math.round(item.distanceKm).toLocaleString()} km`
    return item.points.length >= 2 ? `${distance} · ${bearingText(item.points[0], item.points[1])}` : distance
  }
  if (item.kind === 'polygon' && item.areaKm2 !== null) return formatAreaKm2(item.areaKm2)
  return '标注点'
}

async function handleRemove(id: string): Promise<void> {
  try {
    await store.removeAnnotation(id)
  } catch (cause) {
    globeStore.setGlobeError(cause instanceof Error ? cause.message : '删除失败')
  }
}

async function handleImportFile(): Promise<void> {
  try {
    const summary = await store.importFromFile()
    if (summary && summary.annotations === 0 && summary.overlays === 0) message.warning('文件中没有可导入的标注')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '导入失败')
  }
}

async function handleSample(id: string): Promise<void> {
  const dataset = SAMPLE_DATASETS.find((item) => item.id === id)
  if (!dataset) return
  try {
    await store.importFromText(`${dataset.name}.kml`, 'kml', dataset.kml)
    store.setPanelOpen(true)
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '示例导入失败')
  }
}

async function handleExport(groupIds: string[] | null): Promise<void> {
  try {
    const saved = await store.exportKml(groupIds)
    if (saved) message.success('导出成功')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '导出失败')
  }
}

async function handleGroupVisible(groupId: string, visible: boolean): Promise<void> {
  try {
    await store.setGroupVisible(groupId, visible)
  } catch (cause) {
    globeStore.setGlobeError(cause instanceof Error ? cause.message : '分组更新失败')
  }
}

async function handleRemoveGroup(groupId: string): Promise<void> {
  try {
    await store.removeGroup(groupId)
  } catch (cause) {
    globeStore.setGlobeError(cause instanceof Error ? cause.message : '分组删除失败')
  }
}

async function handleOverlayVisible(id: string, visible: boolean): Promise<void> {
  try {
    await store.setOverlayVisible(id, visible)
  } catch (cause) {
    globeStore.setGlobeError(cause instanceof Error ? cause.message : '叠加更新失败')
  }
}

async function handleOverlayOpacity(id: string, opacity: number): Promise<void> {
  try {
    await store.setOverlayOpacity(id, opacity)
  } catch (cause) {
    globeStore.setGlobeError(cause instanceof Error ? cause.message : '叠加更新失败')
  }
}

async function handleRemoveOverlay(id: string): Promise<void> {
  try {
    await store.removeOverlay(id)
  } catch (cause) {
    globeStore.setGlobeError(cause instanceof Error ? cause.message : '叠加删除失败')
  }
}

function openStylePopover(annotation: AnnotationData, open: boolean): void {
  styleEditing.value = open ? annotation : null
}

function editStyleDraft(): AnnotationStyle {
  const source = styleEditing.value
  if (!source) return { color: '#1677ff', lineWidth: 3, fillOpacity: 0.28, icon: 'circle', iconScale: 1 }
  return source.style ?? { color: '#1677ff', lineWidth: 3, fillOpacity: 0.28, icon: 'circle', iconScale: 1 }
}

async function patchStyle(patch: Partial<AnnotationStyle>): Promise<void> {
  const target = styleEditing.value
  if (!target) return
  const next = { ...editStyleDraft(), ...patch }
  styleEditing.value = { ...target, style: next }
  try {
    await store.updateAnnotation(target.id, { style: next })
  } catch (cause) {
    globeStore.setGlobeError(cause instanceof Error ? cause.message : '样式保存失败')
  }
}

function startRename(annotation: AnnotationData): void {
  renamingId.value = annotation.id
  renameValue.value = annotation.name
}

async function commitRename(): Promise<void> {
  const id = renamingId.value
  const name = renameValue.value.trim()
  renamingId.value = ''
  if (!id || !name) return
  try {
    await store.updateAnnotation(id, { name })
  } catch (cause) {
    globeStore.setGlobeError(cause instanceof Error ? cause.message : '重命名失败')
  }
}

async function toggleVisible(annotation: AnnotationData, visible: boolean): Promise<void> {
  try {
    await store.updateAnnotation(annotation.id, { visible })
  } catch (cause) {
    globeStore.setGlobeError(cause instanceof Error ? cause.message : '标注更新失败')
  }
}
</script>

<template>
  <div v-if="store.panelOpen" class="draw-panel">
    <div class="panel-title">
      <div><div class="panel-kicker">DRAW · MEASURE · ANNOTATE</div><h2>教学标注 · 量测</h2></div>
      <a-button type="text" aria-label="关闭标注面板" @click="store.setPanelOpen(false)"><CloseOutlined /></a-button>
    </div>
    <div class="action-row">
      <a-button size="small" :loading="store.importing" @click="handleImportFile"><ImportOutlined /><span class="mode-label">导入 KML / GPX</span></a-button>
      <a-button size="small" :disabled="!store.annotations.length && !store.overlays.length" @click="handleExport(null)"><ExportOutlined /><span class="mode-label">导出全部</span></a-button>
      <a-dropdown>
        <a-button size="small"><DownOutlined /><span class="mode-label">示例数据</span></a-button>
        <template #overlay>
          <a-menu @click="({ key }: { key: string | number }) => handleSample(String(key))">
            <a-menu-item v-for="dataset in SAMPLE_DATASETS" :key="dataset.id">
              <div class="dataset-item">
                <div>{{ dataset.name }}</div>
                <div class="dataset-desc">{{ dataset.description }}</div>
              </div>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>
    <div class="mode-row">
      <a-button v-for="item in modes" :key="item.key" size="small" :type="store.mode === item.key ? 'primary' : 'default'" :aria-label="item.label" @click="store.setMode(item.key)">
        <component :is="item.icon" /><span class="mode-label">{{ item.label }}</span>
      </a-button>
    </div>
    <p class="mode-hint">{{ modeHint }}</p>
    <a-alert v-if="store.notice" type="success" show-icon closable :message="store.notice" class="notice" @close="store.clearNotice()" />
    <div class="annotation-list">
      <a-empty v-if="!store.annotations.length && !store.overlays.length" description="还没有标注，选择工具绘制或导入数据" />
      <div v-if="store.overlays.length" class="overlay-section">
        <div class="section-title"><PictureOutlined /><span>影像叠加</span></div>
        <div v-for="overlay in store.overlays" :key="overlay.id" class="annotation-item">
          <div class="annotation-main">
            <a-switch size="small" :checked="overlay.visible" :aria-label="`${overlay.name} 显隐`" @change="(value: boolean | string | number) => handleOverlayVisible(overlay.id, value === true)" />
            <span class="annotation-name">{{ overlay.name }}</span>
          </div>
          <div class="annotation-actions">
            <a-slider class="overlay-slider" :value="overlay.opacity" :min="0.05" :max="1" :step="0.05" :aria-label="`${overlay.name} 透明度`" @change="(value: number | number[]) => handleOverlayOpacity(overlay.id, Array.isArray(value) ? value[0] : value)" />
            <a-button type="link" size="small" aria-label="定位叠加影像" @click="store.locateOverlays(overlay)">定位</a-button>
            <a-button type="link" size="small" danger aria-label="删除叠加影像" @click="handleRemoveOverlay(overlay.id)"><DeleteOutlined /></a-button>
          </div>
        </div>
      </div>
      <a-collapse v-if="visibleGroups.length" v-model:activeKey="groupCollapse" ghost class="group-collapse">
        <a-collapse-panel v-for="entry in visibleGroups" :key="entry.group?.id ?? 'ungrouped'">
          <template #header>
            <div class="group-header">
              <a-checkbox
                v-if="entry.group"
                :checked="groupVisibility(entry.items)"
                :aria-label="`${entry.group.name} 显隐`"
                @click.stop
                @change="(event: Event) => handleGroupVisible(entry.group!.id, (event.target as HTMLInputElement).checked)"
              />
              <span class="group-name">{{ entry.group?.name ?? '未分组' }}</span>
              <span class="group-count">{{ entry.items.length }}</span>
            </div>
          </template>
          <template #extra>
            <span class="group-actions" @click.stop>
              <a-button v-if="entry.group" type="link" size="small" aria-label="导出分组" @click="handleExport([entry.group.id])">导出</a-button>
              <a-button v-if="entry.group" type="link" size="small" danger aria-label="删除分组" @click="handleRemoveGroup(entry.group.id)"><DeleteOutlined /></a-button>
            </span>
          </template>
          <div v-for="item in entry.items" :key="item.id" class="annotation-item">
            <div class="annotation-main">
              <a-checkbox :checked="item.visible" :aria-label="`${item.name} 显隐`" @change="(event: Event) => toggleVisible(item, (event.target as HTMLInputElement).checked)" />
              <a-input
                v-if="renamingId === item.id"
                v-model:value="renameValue"
                size="small"
                class="rename-input"
                aria-label="标注名称"
                @blur="commitRename"
                @keyup.enter="commitRename"
              />
              <button v-else class="annotation-name rename-target" :aria-label="`重命名 ${item.name}`" @dblclick="startRename(item)">{{ item.name }}</button>
              <span class="annotation-measure">{{ formatMeasure(item) }}</span>
              <span v-if="item.style" class="style-dot" :style="{ background: item.style.color }" />
            </div>
            <div class="annotation-actions">
              <a-button type="link" size="small" aria-label="定位标注" @click="store.locate(item.points, item.kind)">定位</a-button>
              <a-popover trigger="click" placement="left" @open-change="(open: boolean) => openStylePopover(item, open)">
                <template #title>样式</template>
                <template #content>
                  <div v-if="styleEditing?.id === item.id" class="style-editor">
                    <div class="swatch-row">
                      <button
                        v-for="color in PALETTE"
                        :key="color"
                        class="swatch"
                        :class="{ active: editStyleDraft().color === color }"
                        :style="{ background: color }"
                        :aria-label="`颜色 ${color}`"
                        @click="patchStyle({ color })"
                      />
                    </div>
                    <template v-if="item.kind === 'point'">
                      <div class="style-field"><span>图标</span>
                        <a-segmented :value="editStyleDraft().icon" :options="ICON_OPTIONS" size="small" @change="(value: string | number) => patchStyle({ icon: value as AnnotationIcon })" />
                      </div>
                      <div class="style-field"><span>大小</span>
                        <a-slider :value="editStyleDraft().iconScale" :min="0.5" :max="3" :step="0.1" class="style-slider" @change="(value: number | number[]) => patchStyle({ iconScale: Array.isArray(value) ? value[0] : value })" />
                      </div>
                    </template>
                    <template v-else>
                      <div class="style-field"><span>线宽</span>
                        <a-slider :value="editStyleDraft().lineWidth" :min="1" :max="10" :step="0.5" class="style-slider" @change="(value: number | number[]) => patchStyle({ lineWidth: Array.isArray(value) ? value[0] : value })" />
                      </div>
                      <div v-if="item.kind === 'polygon'" class="style-field"><span>填充</span>
                        <a-slider :value="editStyleDraft().fillOpacity" :min="0" :max="1" :step="0.05" class="style-slider" @change="(value: number | number[]) => patchStyle({ fillOpacity: Array.isArray(value) ? value[0] : value })" />
                      </div>
                    </template>
                  </div>
                </template>
                <a-button type="link" size="small" aria-label="编辑样式"><BgColorsOutlined /></a-button>
              </a-popover>
              <a-button type="link" size="small" danger aria-label="删除标注" @click="handleRemove(item.id)"><DeleteOutlined /></a-button>
            </div>
          </div>
        </a-collapse-panel>
      </a-collapse>
    </div>
  </div>
</template>

<style scoped>
.draw-panel {
  position: absolute;
  left: 76px;
  bottom: 16px;
  z-index: 90;
  width: 430px;
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
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.action-row,
.mode-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.mode-label {
  margin-left: 4px;
}

.mode-hint {
  margin: 6px 0 8px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}

.notice {
  margin-bottom: 8px;
}

.annotation-list {
  max-height: 340px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dataset-item {
  display: flex;
  flex-direction: column;
}

.dataset-desc {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 18px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
  margin-bottom: 2px;
}

.group-collapse {
  background: transparent;
}

.group-collapse :deep(.ant-collapse-item) {
  border: none;
}

.group-collapse :deep(.ant-collapse-header) {
  padding: 4px 0 !important;
  color: rgba(0, 0, 0, 0.88);
}

.group-collapse :deep(.ant-collapse-content-box) {
  padding: 0 0 6px 8px !important;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.group-name {
  color: rgba(0, 0, 0, 0.88);
  font-size: 13px;
  font-weight: 600;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-count {
  flex: none;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.group-actions {
  display: flex;
  align-items: center;
}

.annotation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 6px;
}

.annotation-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.annotation-name {
  color: rgba(0, 0, 0, 0.88);
  font-size: 13px;
  line-height: 22px;
  white-space: nowrap;
}

.rename-target {
  border: none;
  background: transparent;
  padding: 0;
  cursor: text;
}

.rename-target:hover {
  color: #4096ff;
}

.rename-input {
  width: 120px;
}

.annotation-measure {
  color: #1677ff;
  font-size: 12px;
  line-height: 20px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.style-dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid rgba(5, 5, 5, 0.15);
}

.annotation-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
}

.overlay-slider {
  width: 72px;
  margin: 0 4px 0 0;
}

.style-editor {
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.swatch-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(5, 5, 5, 0.15);
  cursor: pointer;
  padding: 0;
}

.swatch.active {
  outline: 2px solid #1677ff;
  outline-offset: 1px;
}

.style-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.style-field > span:first-child {
  width: 28px;
  flex: none;
}

.style-slider {
  flex: 1;
  margin: 0;
}
</style>
