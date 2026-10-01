<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

const globeContainer = ref<HTMLDivElement>()
let viewer: Cesium.Viewer | undefined

onMounted(() => {
  if (!globeContainer.value) return

  viewer = new Cesium.Viewer(globeContainer.value, {
    baseLayer: false,
    baseLayerPicker: false,
    geocoder: false,
    animation: false,
    timeline: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    homeButton: false,
    infoBox: false,
    selectionIndicator: false
  })

  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      credit: '© OpenStreetMap contributors'
    })
  )

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(105, 35, 15000000)
  })
})

onBeforeUnmount(() => {
  viewer?.destroy()
})
</script>

<template>
  <div ref="globeContainer" class="globe"></div>
</template>

<style scoped>
.globe {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
