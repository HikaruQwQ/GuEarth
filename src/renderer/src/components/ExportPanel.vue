<script setup lang="ts">
import { computed, ref } from 'vue'
import * as Cesium from 'cesium'
import { CameraOutlined, CopyOutlined, CloseOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { ScaleBarReadout } from '@renderer/composables/useScaleBar'
import { useLegendSections } from '@renderer/utils/legendEntries'
import { blobToBase64, canvasToBlob, captureScene, composeExportImage } from '@renderer/utils/capture'

const props = defineProps<{
  resolveViewer: () => Cesium.Viewer | undefined
  scaleBar: ScaleBarReadout | null
  heading: number
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const sections = useLegendSections()
const title = ref('')
const factor = ref(2)
const includeLegend = ref(true)
const includeScale = ref(true)
const includeNorth = ref(true)
const includeDate = ref(true)
const working = ref(false)

const factorOptions = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' }
]

const dateText = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
})

async function compose(): Promise<Blob | null> {
  const viewer = props.resolveViewer()
  if (!viewer || viewer.isDestroyed()) return null
  working.value = true
  try {
    const base = await captureScene(viewer, factor.value)
    if (!base) {
      message.error('截图失败')
      return null
    }
    const composed = composeExportImage(base, {
      title: title.value.trim(),
      dateText: dateText.value,
      sections: sections.value,
      scaleBar: props.scaleBar,
      heading: props.heading,
      displayScale: base.width / viewer.canvas.clientWidth,
      includeLegend: includeLegend.value,
      includeScale: includeScale.value,
      includeNorth: includeNorth.value,
      includeDate: includeDate.value
    })
    return await canvasToBlob(composed)
  } finally {
    working.value = false
  }
}

async function handleCopy(): Promise<void> {
  try {
    const blob = await compose()
    if (!blob) return
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    message.success('已复制到剪贴板，可直接粘贴到 PPT / 文档')
  } catch {
    message.error('复制失败，请尝试保存为文件')
  }
}

async function handleSave(): Promise<void> {
  try {
    const blob = await compose()
    if (!blob) return
    const base64 = await blobToBase64(blob)
    const saved = await window.guEarth.geoio.saveBinary(title.value.trim() || `GuEarth_${dateText.value}`, base64, 'png', 'image/png')
    if (saved) message.success('已保存')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '保存失败')
  }
}
</script>

<template>
  <div v-if="open" class="export-panel">
    <div class="panel-title">
      <div><div class="panel-kicker">CAPTURE · CARTOGRAPHY</div><h2>出图</h2></div>
      <a-button type="text" aria-label="关闭出图面板" @click="emit('close')"><CloseOutlined /></a-button>
    </div>
    <a-input v-model:value="title" placeholder="图片标题（可留空）" aria-label="图片标题" />
    <div class="option-row">
      <span class="option-label">倍率</span>
      <a-segmented v-model:value="factor" :options="factorOptions" size="small" />
    </div>
    <div class="option-row">
      <a-checkbox v-model:checked="includeLegend">图例</a-checkbox>
      <a-checkbox v-model:checked="includeScale">比例尺</a-checkbox>
      <a-checkbox v-model:checked="includeNorth">指北针</a-checkbox>
      <a-checkbox v-model:checked="includeDate">日期</a-checkbox>
    </div>
    <div class="action-row">
      <a-button type="primary" size="small" :loading="working" @click="handleCopy"><CopyOutlined /><span class="mode-label">复制图像</span></a-button>
      <a-button size="small" :loading="working" @click="handleSave"><SaveOutlined /><span class="mode-label">保存 PNG</span></a-button>
    </div>
    <p class="hint"><CameraOutlined /> 复制后可直接粘贴到 PPT 与学案文档</p>
  </div>
</template>

<style scoped>
.export-panel {
  position: absolute;
  top: 72px;
  right: 16px;
  z-index: 90;
  width: 280px;
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

.option-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.option-label {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
}

.action-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.mode-label {
  margin-left: 4px;
}

.hint {
  margin: 10px 0 0;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
}
</style>
