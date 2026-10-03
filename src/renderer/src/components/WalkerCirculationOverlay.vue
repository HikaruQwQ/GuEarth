<script setup lang="ts">
import { onBeforeUnmount, ref, toRaw, watch } from 'vue'
import * as Cesium from 'cesium'
import { ensoPhaseMeta, type EnsoPhase } from '@renderer/thematic/ensoPhases'

const props = defineProps<{ viewer?: Cesium.Viewer; phase: EnsoPhase }>()

const overlayRef = ref<HTMLDivElement>()
const ANCHOR = Cesium.Cartesian3.fromDegrees(205, 0)
const ANCHOR_VIEW_HEIGHT = 9500000
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
  const scale = Math.min(1.05, Math.max(0.4, height / ANCHOR_VIEW_HEIGHT))
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

const RISING = '#f5222d'
const SINKING = '#1677ff'
const FLOW = '#722ed1'
</script>

<template>
  <div ref="overlayRef" class="walker-overlay" style="display: none" aria-hidden="true">
    <svg viewBox="0 0 380 200" width="380" height="200">
      <rect x="2" y="2" width="376" height="196" rx="10" fill="rgba(255,255,255,0.85)" stroke="rgba(5,5,5,0.06)" />
      <path d="M0 160 L110 160 A 80 34 0 0 1 270 160 L380 160 L380 200 L0 200 Z" fill="rgba(22, 119, 255, 0.18)" />
      <path d="M60 160 Q 75 96 118 74" :fill="phase === 'el-nino' ? 'none' : 'none'" stroke="rgba(0,0,0,0.2)" stroke-width="1" />
      <path v-if="phase !== 'el-nino'" d="M0 158 Q 90 120 200 116 Q 300 112 380 130 L 380 160 L 0 160 Z" fill="rgba(82, 196, 26, 0.14)" />
      <path v-else d="M0 158 Q 90 120 150 116 L 380 118 L 380 160 L 0 160 Z" fill="rgba(82, 196, 26, 0.14)" />
      <g v-if="phase === 'normal'">
        <path d="M 96 148 C 92 110 100 76 118 56" fill="none" :stroke="RISING" stroke-width="3" marker-end="url(#walker-head)" class="walker-flow" />
        <path d="M 124 50 Q 190 30 250 46" fill="none" :stroke="FLOW" stroke-width="3" marker-end="url(#walker-head)" class="walker-flow" />
        <path d="M 268 52 C 280 78 286 112 288 144" fill="none" :stroke="SINKING" stroke-width="3" marker-end="url(#walker-head)" class="walker-flow" />
        <path d="M 272 150 Q 190 176 112 152" fill="none" :stroke="FLOW" stroke-width="3" marker-end="url(#walker-head)" class="walker-flow" />
      </g>
      <g v-else-if="phase === 'el-nino'">
        <path d="M 196 148 C 192 112 198 82 212 62" fill="none" :stroke="RISING" stroke-width="3" marker-end="url(#walker-head)" class="walker-flow" />
        <path d="M 218 56 Q 262 44 296 56" fill="none" :stroke="FLOW" stroke-width="3" marker-end="url(#walker-head)" class="walker-flow" />
        <path d="M 306 66 C 314 92 318 118 320 144" fill="none" :stroke="SINKING" stroke-width="2.2" stroke-dasharray="6 5" marker-end="url(#walker-head)" class="walker-flow" />
        <path d="M 310 150 Q 250 170 196 154" fill="none" :stroke="FLOW" stroke-width="1.8" stroke-dasharray="6 5" marker-end="url(#walker-head)" class="walker-flow" />
        <path d="M 180 150 Q 130 168 92 156" fill="none" :stroke="FLOW" stroke-width="1.4" stroke-dasharray="3 6" opacity="0.7" marker-end="url(#walker-head)" class="walker-flow" />
      </g>
      <g v-else>
        <path d="M 88 148 C 82 108 92 70 112 48" fill="none" :stroke="RISING" stroke-width="3.6" marker-end="url(#walker-head)" class="walker-flow" />
        <path d="M 120 42 Q 195 20 268 42" fill="none" :stroke="FLOW" stroke-width="3.6" marker-end="url(#walker-head)" class="walker-flow" />
        <path d="M 286 50 C 298 80 304 116 306 146" fill="none" :stroke="SINKING" stroke-width="3.6" marker-end="url(#walker-head)" class="walker-flow" />
        <path d="M 292 152 Q 190 182 96 154" fill="none" :stroke="FLOW" stroke-width="3.6" marker-end="url(#walker-head)" class="walker-flow" />
      </g>
      <defs>
        <marker id="walker-head" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="rgba(0,0,0,0.55)" />
        </marker>
      </defs>
      <g font-size="11" font-family='"Microsoft YaHei", "PingFang SC", sans-serif'>
        <text x="96" y="176" fill="rgba(0,0,0,0.65)" text-anchor="middle">西太平洋·暖池（印尼）</text>
        <text x="296" y="176" fill="rgba(0,0,0,0.65)" text-anchor="middle">东太平洋（南美沿岸）</text>
        <text x="60" y="96" :fill="RISING" font-weight="600" v-if="phase !== 'el-nino'">上升气流</text>
        <text x="222" y="120" :fill="RISING" font-weight="600" v-else>上升气流东移</text>
        <text x="296" y="112" :fill="SINKING" font-weight="600">下沉气流</text>
        <text x="190" y="42" :fill="FLOW" font-weight="600" text-anchor="middle">高空向东流</text>
        <text x="190" y="168" :fill="FLOW" font-weight="600" text-anchor="middle" v-if="phase !== 'el-nino'">信风（近地面自东向西）</text>
        <text x="190" y="168" :fill="FLOW" font-weight="600" text-anchor="middle" v-else>信风减弱甚至转向</text>
      </g>
      <text x="190" y="192" text-anchor="middle" font-size="11" fill="rgba(0,0,0,0.45)" font-family='"Microsoft YaHei", "PingFang SC", sans-serif'>沃克环流剖面示意（{{ ensoPhaseMeta[phase].name }}）</text>
    </svg>
  </div>
</template>

<style scoped>
.walker-overlay {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: 9;
}

.walker-flow {
  stroke-dasharray: 8 6;
  animation: walker-dash 1.2s linear infinite;
}

@keyframes walker-dash {
  to {
    stroke-dashoffset: -14;
  }
}

@media (prefers-reduced-motion: reduce) {
  .walker-flow {
    animation: none;
  }
}
</style>
