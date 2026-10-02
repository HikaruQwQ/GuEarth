<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useGlobeStore } from '@renderer/stores/globe'
import { useCesiumViewer } from '@renderer/composables/useCesiumViewer'
import GlobeToolbar from '@renderer/components/GlobeToolbar.vue'
import CameraStatus from '@renderer/components/CameraStatus.vue'
import LayerPanel from '@renderer/components/LayerPanel.vue'

const store = useGlobeStore()
const { isLayerPanelOpen, layers, selectedLayerId, globeError, isGlobeReady, camera } =
  storeToRefs(store)

const globeContainer = ref<HTMLDivElement>()
const { switchBasemap, setLayerOpacity, flyTo } = useCesiumViewer(globeContainer)

function handleOpenLayers(): void {
  store.setLayerPanelOpen(true)
}

function handleClosePanel(): void {
  store.setLayerPanelOpen(false)
}

function handleSelectLayer(id: string): void {
  switchBasemap(id)
}

function handleOpacityChange(id: string, opacity: number): void {
  setLayerOpacity(id, opacity)
}

function handleHome(): void {
  flyTo(105, 35, 15000000)
}

function handleRetry(): void {
  location.reload()
}
</script>

<template>
  <div class="app">
    <div ref="globeContainer" class="globe"></div>
    <GlobeToolbar @open-layers="handleOpenLayers" @home="handleHome" />
    <CameraStatus :camera="camera" />
    <LayerPanel
      :open="isLayerPanelOpen"
      :layers="layers"
      :selected-layer-id="selectedLayerId"
      :error="globeError"
      :loading="!isGlobeReady"
      @close="handleClosePanel"
      @select="handleSelectLayer"
      @opacity="handleOpacityChange"
      @retry="handleRetry"
    />
  </div>
</template>

<style scoped>
.app {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.globe {
  width: 100%;
  height: 100%;
}
</style>
