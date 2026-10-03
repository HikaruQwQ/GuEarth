<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type CSSProperties } from 'vue'
import * as Cesium from 'cesium'
import type { DrawnShape } from '@renderer/stores/drawing'

const props = defineProps<{
  viewer: Cesium.Viewer | undefined
  shape: DrawnShape | null
}>()

const emit = defineEmits<{
  update: [value: string]
}>()

const root = ref<HTMLDivElement>()
const editor = ref<HTMLTextAreaElement>()
const position = reactive<{ left: string; top: string; visibility: 'hidden' | 'visible' }>({ left: '0px', top: '0px', visibility: 'hidden' })
let removePreRender: (() => void) | undefined

function editorTextShadow(color: string, framed: boolean): string {
  if (framed) return 'none'
  const match = /^#([\da-f]{6})$/i.exec(color)
  if (!match) return '0 0 3px rgba(0, 0, 0, 0.9)'
  const red = Number.parseInt(match[1].slice(0, 2), 16)
  const green = Number.parseInt(match[1].slice(2, 4), 16)
  const blue = Number.parseInt(match[1].slice(4, 6), 16)
  const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255
  const halo = luminance > 0.55 ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.96)'
  return `0 0 2px ${halo}, 0 0 4px ${halo}`
}

const editorStyle = computed<CSSProperties>(() => {
  const shape = props.shape
  if (!shape || shape.kind !== 'text') return {}
  return {
    left: position.left,
    top: position.top,
    visibility: position.visibility,
    color: shape.textColor,
    fontFamily: `"${shape.fontFamily}", sans-serif`,
    fontSize: `${shape.fontSize}px`,
    textShadow: editorTextShadow(shape.textColor, shape.textFrame),
    backgroundColor: shape.textFrame ? 'rgba(255, 255, 255, 0.96)' : 'transparent',
    borderColor: shape.textFrame ? shape.color : 'transparent'
  }
})

function updatePosition(): void {
  const viewer = props.viewer
  const shape = props.shape
  if (!viewer || viewer.isDestroyed() || !root.value || !shape || shape.kind !== 'text') {
    position.visibility = 'hidden'
    return
  }
  const anchor = shape.positions[0]
  const worldPosition = Cesium.Cartesian3.fromDegrees(anchor.longitude, anchor.latitude, anchor.height)
  const screenPosition = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, worldPosition)
  if (!screenPosition) {
    position.visibility = 'hidden'
    return
  }
  const canvasRect = viewer.scene.canvas.getBoundingClientRect()
  const rootRect = root.value.getBoundingClientRect()
  position.left = `${canvasRect.left - rootRect.left + screenPosition.x}px`
  position.top = `${canvasRect.top - rootRect.top + screenPosition.y - 12}px`
  position.visibility = 'visible'
}

function bindViewer(viewer: Cesium.Viewer | undefined): void {
  removePreRender?.()
  removePreRender = undefined
  if (!viewer || viewer.isDestroyed()) return
  updatePosition()
  removePreRender = viewer.scene.preRender.addEventListener(updatePosition)
}

function resizeEditor(): void {
  if (!editor.value) return
  editor.value.style.height = 'auto'
  editor.value.style.height = `${Math.max(32, editor.value.scrollHeight)}px`
}

function handleInput(event: Event): void {
  emit('update', (event.target as HTMLTextAreaElement).value)
  resizeEditor()
}

watch(() => props.viewer, bindViewer, { immediate: true })
watch(() => props.shape?.id, async (id) => {
  if (!id || props.shape?.kind !== 'text') return
  await nextTick()
  editor.value?.focus()
  editor.value?.setSelectionRange(editor.value.value.length, editor.value.value.length)
  resizeEditor()
  updatePosition()
})

watch(() => props.shape?.annotation, async () => {
  await nextTick()
  resizeEditor()
})

onMounted(updatePosition)
onBeforeUnmount(() => removePreRender?.())
</script>

<template>
  <div ref="root" class="text-editor-overlay">
    <textarea
      v-if="shape?.kind === 'text'"
      ref="editor"
      :value="shape.annotation"
      :style="editorStyle"
      class="text-editor"
      rows="1"
      maxlength="200"
      aria-label="编辑文本框"
      placeholder="输入文本"
      @input="handleInput"
    />
  </div>
</template>

<style scoped>
.text-editor-overlay {
  position: absolute;
  inset: 0;
  z-index: 12;
  overflow: hidden;
  pointer-events: none;
}

.text-editor {
  position: absolute;
  width: 280px;
  min-height: 32px;
  max-height: 240px;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  outline: none;
  line-height: 1.4;
  resize: none;
  overflow: auto;
  pointer-events: auto;
  transform: translateY(-100%);
}

.text-editor:focus {
  outline: 2px solid rgba(22, 119, 255, 0.35);
}

.text-editor::placeholder {
  color: rgba(0, 0, 0, 0.4);
}
</style>
