<script setup lang="ts">
import { onBeforeUnmount, ref, toRaw, watch } from 'vue'
import * as Cesium from 'cesium'

const props = defineProps<{ viewer?: Cesium.Viewer }>()

const overlayRef = ref<HTMLDivElement>()
const ANCHOR = Cesium.Cartesian3.fromDegrees(138, 15)
const ANCHOR_VIEW_HEIGHT = 6200000
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
  <div ref="overlayRef" class="typhoon-overlay" style="display: none" aria-hidden="true">
    <svg viewBox="0 0 340 340" width="340" height="340">
      <rect x="2" y="2" width="336" height="336" rx="10" fill="rgba(255,255,255,0.82)" stroke="rgba(5,5,5,0.06)" />
      <g class="typhoon-spin">
        <g fill="none" stroke="#fa8c16" stroke-width="3" opacity="0.75">
          <path d="M 170 128 A 34 34 0 0 1 204 166" />
          <path d="M 196 210 A 34 34 0 0 1 140 194" />
          <path d="M 118 152 A 46 46 0 0 1 172 112" opacity="0.6" />
          <path d="M 212 176 A 46 46 0 0 1 158 208" opacity="0.6" />
        </g>
        <g fill="none" stroke="#fa8c16" stroke-width="5" opacity="0.45" stroke-linecap="round">
          <path d="M 170 44 Q 232 52 262 96" />
          <path d="M 262 96 Q 288 134 284 178" />
          <path d="M 148 44 Q 84 58 62 110" />
          <path d="M 62 110 Q 44 152 60 198" />
          <path d="M 88 268 Q 128 296 172 292" />
          <path d="M 252 246 Q 226 288 178 292" />
        </g>
        <g fill="none" stroke="#fa8c16" stroke-width="2" stroke-dasharray="1 7" opacity="0.85" stroke-linecap="round">
          <path d="M 170 44 Q 232 52 262 96" />
          <path d="M 148 44 Q 84 58 62 110" />
          <path d="M 62 110 Q 44 152 60 198" />
          <path d="M 88 268 Q 128 296 172 292" />
          <path d="M 252 246 Q 226 288 178 292" />
        </g>
        <g fill="#fa8c16" opacity="0.9">
          <polygon points="0,-6 11,0 0,6" transform="translate(262 96) rotate(52)" />
          <polygon points="0,-6 11,0 0,6" transform="translate(62 110) rotate(-118)" />
          <polygon points="0,-6 11,0 0,6" transform="translate(88 268) rotate(14)" />
          <polygon points="0,-6 11,0 0,6" transform="translate(252 246) rotate(-158)" />
        </g>
      </g>
      <circle cx="170" cy="170" r="30" fill="none" stroke="#f5222d" stroke-width="10" opacity="0.35" />
      <circle cx="170" cy="170" r="30" fill="none" stroke="#f5222d" stroke-width="2.5" />
      <circle cx="170" cy="170" r="14" fill="#ffffff" stroke="#f5222d" stroke-width="2" />
      <g font-size="11" font-family='"Microsoft YaHei", "PingFang SC", sans-serif' text-anchor="middle">
        <text x="170" y="174" fill="#f5222d" font-weight="600">台风眼</text>
        <text x="238" y="122" fill="#f5222d" font-weight="600">眼墙</text>
        <text x="238" y="136" fill="rgba(0,0,0,0.65)">狂风暴雨最强</text>
        <text x="268" y="304" fill="#fa8c16" font-weight="600">漩涡风雨区</text>
        <text x="268" y="318" fill="rgba(0,0,0,0.65)">外围螺旋云雨带</text>
        <text x="62" y="60" fill="rgba(0,0,0,0.65)">气流逆时针</text>
        <text x="62" y="74" fill="rgba(0,0,0,0.65)">向中心辐合</text>
      </g>
      <text x="170" y="330" text-anchor="middle" font-size="11" fill="rgba(0,0,0,0.45)" font-family='"Microsoft YaHei", "PingFang SC", sans-serif'>北半球台风（热带气旋）俯视结构示意</text>
    </svg>
  </div>
</template>

<style scoped>
.typhoon-overlay {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: 9;
}

.typhoon-spin {
  transform-origin: 170px 170px;
  animation: typhoon-spin 26s linear infinite;
}

@keyframes typhoon-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .typhoon-spin {
    animation: none;
  }
}
</style>
