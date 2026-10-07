<script setup lang="ts">
import { onBeforeUnmount, ref, toRaw, watch } from 'vue'
import * as Cesium from 'cesium'
import { huComparison } from '@renderer/thematic/populationCensus'

const props = defineProps<{ viewer?: Cesium.Viewer }>()

const eastRef = ref<HTMLDivElement>()
const westRef = ref<HTMLDivElement>()
const ANCHOR_VIEW_HEIGHT = 9000000
const eastAnchor = Cesium.Cartesian3.fromDegrees(119.5, 33)
const westAnchor = Cesium.Cartesian3.fromDegrees(96, 37.5)
const eastScratch = { projected: new Cesium.Cartesian2(), normal: new Cesium.Cartesian3(), toCamera: new Cesium.Cartesian3() }
const westScratch = { projected: new Cesium.Cartesian2(), normal: new Cesium.Cartesian3(), toCamera: new Cesium.Cartesian3() }
let activeViewer: Cesium.Viewer | undefined
let removeListener: (() => void) | undefined

function updateCard(current: Cesium.Viewer, element: HTMLDivElement | undefined, anchor: Cesium.Cartesian3, scratch: { projected: Cesium.Cartesian2; normal: Cesium.Cartesian3; toCamera: Cesium.Cartesian3 }): void {
  if (!element) return
  let facing = true
  if (current.scene.mode === Cesium.SceneMode.SCENE3D) {
    current.scene.globe.ellipsoid.geodeticSurfaceNormal(anchor, scratch.normal)
    Cesium.Cartesian3.subtract(current.camera.positionWC, anchor, scratch.toCamera)
    facing = Cesium.Cartesian3.dot(scratch.normal, scratch.toCamera) > 0
  }
  const projected = facing ? Cesium.SceneTransforms.worldToWindowCoordinates(current.scene, anchor, scratch.projected) : undefined
  if (!projected || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
    element.style.display = 'none'
    return
  }
  const height = current.camera.positionCartographic.height
  const scale = Math.min(1.05, Math.max(0.5, height / ANCHOR_VIEW_HEIGHT))
  element.style.display = 'block'
  element.style.transform = `translate(${projected.x}px, ${projected.y}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`
}

function frame(): void {
  const current = activeViewer
  if (!current || current.isDestroyed()) return
  updateCard(current, eastRef.value, eastAnchor, eastScratch)
  updateCard(current, westRef.value, westAnchor, westScratch)
}

watch(
  () => props.viewer,
  (viewer) => {
    removeListener?.()
    activeViewer = viewer && !viewer.isDestroyed() ? toRaw(viewer) : undefined
    removeListener = activeViewer ? activeViewer.scene.postRender.addEventListener(frame) : undefined
  },
  { immediate: true, flush: 'post' }
)

onBeforeUnmount(() => {
  removeListener?.()
  removeListener = undefined
})
</script>

<template>
  <div ref="eastRef" class="hu-card" style="display: none" aria-hidden="true">
    <div class="hu-card-title">胡线以东</div>
    <div class="hu-card-row"><span>面积</span><span class="hu-card-value">{{ huComparison.eastAreaPct }}%</span></div>
    <div class="hu-card-row"><span>人口</span><span class="hu-card-value strong">{{ huComparison.eastPopPct }}%</span></div>
  </div>
  <div ref="westRef" class="hu-card" style="display: none" aria-hidden="true">
    <div class="hu-card-title">胡线以西</div>
    <div class="hu-card-row"><span>面积</span><span class="hu-card-value">{{ huComparison.westAreaPct }}%</span></div>
    <div class="hu-card-row"><span>人口</span><span class="hu-card-value strong">{{ huComparison.westPopPct }}%</span></div>
  </div>
</template>

<style scoped>
.hu-card {
  position: absolute;
  left: 0;
  top: 0;
  min-width: 132px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(83, 29, 171, 0.35);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: none;
  z-index: 9;
}

.hu-card-title {
  color: #531dab;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.hu-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}

.hu-card-value {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  color: rgba(0, 0, 0, 0.88);
}

.hu-card-value.strong {
  font-weight: 600;
  color: #531dab;
}
</style>
