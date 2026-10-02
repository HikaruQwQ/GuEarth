<script setup lang="ts">
import { onBeforeUnmount, ref, toRaw, watch } from 'vue'
import * as Cesium from 'cesium'

const props = defineProps<{ viewer?: Cesium.Viewer }>()

const overlayRef = ref<HTMLDivElement>()
const ANCHOR = Cesium.Cartesian3.fromDegrees(125, 34)
const ANCHOR_VIEW_HEIGHT = 4800000
const scratch = new Cesium.Cartesian2()
const scratchNormal = new Cesium.Cartesian3()
const scratchToCamera = new Cesium.Cartesian3()
let activeViewer: Cesium.Viewer | undefined
let removeListener: (() => void) | undefined

function frame(): void {
  const current = activeViewer
  const element = overlayRef.value
  if (!current || current.isDestroyed() || !element) return
  let facing = true
  if (current.scene.mode === Cesium.SceneMode.SCENE3D) {
    current.scene.globe.ellipsoid.geodeticSurfaceNormal(ANCHOR, scratchNormal)
    Cesium.Cartesian3.subtract(current.camera.positionWC, ANCHOR, scratchToCamera)
    facing = Cesium.Cartesian3.dot(scratchNormal, scratchToCamera) > 0
  }
  const projected = facing ? Cesium.SceneTransforms.worldToWindowCoordinates(current.scene, ANCHOR, scratch) : undefined
  if (!projected || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
    element.style.display = 'none'
    return
  }
  const height = current.camera.positionCartographic.height
  const scale = Math.min(1.1, Math.max(0.45, height / ANCHOR_VIEW_HEIGHT))
  element.style.display = 'block'
  element.style.transform = `translate(${projected.x}px, ${projected.y}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`
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
  <div ref="overlayRef" class="cyclone-overlay" style="display: none" aria-hidden="true">
    <svg viewBox="0 0 360 360" width="360" height="360">
      <defs>
        <marker id="fc-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="rgba(0,0,0,0.55)" />
        </marker>
      </defs>
      <rect x="2" y="2" width="356" height="356" rx="10" fill="rgba(255,255,255,0.82)" stroke="rgba(5,5,5,0.06)" />
      <g fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.5" stroke-dasharray="6 5">
        <circle cx="180" cy="180" r="62" />
        <circle cx="180" cy="180" r="94" />
        <circle cx="180" cy="180" r="126" />
      </g>
      <g fill="none" stroke="rgba(0,0,0,0.55)" stroke-width="2">
        <path d="M 262 112 A 96 96 0 0 0 98 112" marker-end="url(#fc-arrow)" />
        <path d="M 98 266 A 96 96 0 0 0 264 264" marker-end="url(#fc-arrow)" />
        <path d="M 272 190 L 288 176" marker-end="url(#fc-arrow)" />
        <path d="M 132 258 L 148 274" marker-end="url(#fc-arrow)" />
      </g>
      <path d="M 180 180 Q 140 233 100 296" fill="none" stroke="#1677ff" stroke-width="3.5" />
      <g fill="#1677ff">
        <polygon points="0,-5 10,0 0,5" transform="translate(156 213) rotate(35)" />
        <polygon points="0,-5 10,0 0,5" transform="translate(136 241) rotate(40)" />
        <polygon points="0,-5 10,0 0,5" transform="translate(116 271) rotate(48)" />
      </g>
      <path d="M 180 180 Q 250 208 305 256" fill="none" stroke="#f5222d" stroke-width="3.5" />
      <g fill="#f5222d">
        <path d="M 0 -5 A 5 5 0 0 1 0 5" transform="translate(221 199) rotate(-60)" />
        <path d="M 0 -5 A 5 5 0 0 1 0 5" transform="translate(252 217) rotate(-55)" />
        <path d="M 0 -5 A 5 5 0 0 1 0 5" transform="translate(282 238) rotate(-55)" />
      </g>
      <g fill="#69b1ff" opacity="0.95">
        <circle cx="250" cy="136" r="2.4" /><circle cx="262" cy="148" r="2.4" /><circle cx="275" cy="159" r="2.4" />
        <circle cx="288" cy="169" r="2.4" /><circle cx="300" cy="180" r="2.4" /><circle cx="312" cy="190" r="2.4" />
        <circle cx="323" cy="201" r="2.4" /><circle cx="333" cy="212" r="2.4" /><circle cx="341" cy="222" r="2.4" />
        <circle cx="236" cy="150" r="2.4" /><circle cx="249" cy="161" r="2.4" /><circle cx="262" cy="172" r="2.4" />
        <circle cx="275" cy="182" r="2.4" /><circle cx="288" cy="192" r="2.4" /><circle cx="300" cy="203" r="2.4" />
        <circle cx="312" cy="213" r="2.4" /><circle cx="323" cy="224" r="2.4" />
        <circle cx="148" cy="194" r="2.4" /><circle cx="138" cy="212" r="2.4" /><circle cx="127" cy="230" r="2.4" />
        <circle cx="116" cy="248" r="2.4" /><circle cx="105" cy="265" r="2.4" />
      </g>
      <circle cx="180" cy="180" r="13" fill="#1677ff" />
      <text x="180" y="180" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="600" fill="#ffffff">低</text>
      <g font-size="11" font-family='"Microsoft YaHei", "PingFang SC", sans-serif' text-anchor="middle">
        <text x="192" y="214" fill="rgba(0,0,0,0.65)">低压中心</text>
        <text x="215" y="270" fill="#f5222d">暖气团</text>
        <text x="140" y="118" fill="#1677ff">冷气团</text>
        <text x="92" y="230" fill="#1677ff">冷气团</text>
        <text x="312" y="278" fill="#f5222d" font-weight="600">暖锋</text>
        <text x="82" y="316" fill="#1677ff" font-weight="600">冷锋</text>
        <text x="310" y="126" fill="#1677ff">宽阔雨带</text>
        <text x="66" y="174" fill="#1677ff">狭窄雨带</text>
      </g>
      <text x="180" y="348" text-anchor="middle" font-size="11" fill="rgba(0,0,0,0.45)" font-family='"Microsoft YaHei", "PingFang SC", sans-serif'>北半球锋面气旋（俯视）：气流逆时针辐合，锋面整体自西向东移动</text>
    </svg>
  </div>
</template>

<style scoped>
.cyclone-overlay {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: 9;
}
</style>
