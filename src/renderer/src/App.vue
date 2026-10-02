<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useGlobeStore } from '@renderer/stores/globe'
import { useTerrainLabStore } from '@renderer/stores/terrainLab'
import { useMonsoonStore } from '@renderer/stores/monsoon'
import { useAssistantStore } from '@renderer/stores/assistant'
import { useSolarStore } from '@renderer/stores/solar'
import { useTectonicStore } from '@renderer/stores/tectonic'
import { useDrawStore } from '@renderer/stores/draw'
import { useCesiumViewer } from '@renderer/composables/useCesiumViewer'
import { useRegionTerrain } from '@renderer/composables/useRegionTerrain'
import { useMonsoonLayer } from '@renderer/composables/useMonsoonLayer'
import { usePressureWindLayer } from '@renderer/composables/usePressureWindLayer'
import { useSolarLayer } from '@renderer/composables/useSolarLayer'
import { useTectonicLayer } from '@renderer/composables/useTectonicLayer'
import { useDrawLayer } from '@renderer/composables/useDrawLayer'
import { useMarkers } from '@renderer/composables/useMarkers'
import GlobeToolbar from '@renderer/components/GlobeToolbar.vue'
import CameraStatus from '@renderer/components/CameraStatus.vue'
import LayerPanel from '@renderer/components/LayerPanel.vue'
import LevelViewSwitcher from '@renderer/components/LevelViewSwitcher.vue'
import TerrainLabPanel from '@renderer/components/TerrainLabPanel.vue'
import DrawPanel from '@renderer/components/DrawPanel.vue'
import MonsoonPanel from '@renderer/components/MonsoonPanel.vue'
import SolarPanel from '@renderer/components/SolarPanel.vue'
import TectonicPanel from '@renderer/components/TectonicPanel.vue'
import AssistantPanel from '@renderer/components/AssistantPanel.vue'
import type { GeoBounds } from '../../preload/types'

const store = useGlobeStore()
const terrainLabStore = useTerrainLabStore()
const monsoonStore = useMonsoonStore()
const assistantStore = useAssistantStore()
const solarStore = useSolarStore()
const tectonicStore = useTectonicStore()
const drawStore = useDrawStore()
const {
  isLayerPanelOpen,
  layers,
  selectedLayerId,
  globeError,
  terrainError,
  isGlobeReady,
  camera,
  levelViewActive,
  terrainProviderId,
  terrainExaggeration,
  terrainLighting,
  tileCacheEnabled,
  providerCredentials
} =
  storeToRefs(store)

const globeContainer = ref<HTMLDivElement>()
const { viewer, switchBasemap, setLayerOpacity, flyTo, toggleLevelView, setTerrain, setTerrainExaggeration, setTerrainLighting } = useCesiumViewer(globeContainer)
const levelSwitcherVisible = computed(() => isGlobeReady.value && camera.value.height < 5000000)
const regionTerrain = useRegionTerrain(viewer)
useMonsoonLayer(viewer)
usePressureWindLayer(viewer)
useSolarLayer(viewer)
useTectonicLayer(viewer)
useDrawLayer(viewer)
drawStore.registerFly(flyTo)
tectonicStore.registerFly(flyTo)
const markers = useMarkers(viewer)
terrainLabStore.registerLab(regionTerrain)
const toolbarActive = computed(() => {
  const active: string[] = []
  if (isLayerPanelOpen.value) active.push('layers')
  if (terrainLabStore.panelOpen) active.push('terrain')
  if (drawStore.panelOpen) active.push('draw')
  if (monsoonStore.panelOpen) active.push('monsoon')
  if (solarStore.panelOpen) active.push('solar')
  if (tectonicStore.panelOpen) active.push('tectonic')
  if (assistantStore.open) active.push('assistant')
  return active
})

function currentViewBounds(): GeoBounds | null {
  const currentViewer = viewer.value
  if (!currentViewer || currentViewer.isDestroyed()) return null
  const rectangle = currentViewer.camera.computeViewRectangle()
  if (!rectangle) return null
  return {
    west: Cesium.Math.toDegrees(rectangle.west),
    south: Cesium.Math.toDegrees(rectangle.south),
    east: Cesium.Math.toDegrees(rectangle.east),
    north: Cesium.Math.toDegrees(rectangle.north)
  }
}

assistantStore.registerTools({
  flyTo: (lon, lat, height) => {
    const resolved = height ?? Math.min(Math.max(camera.value.height, 60000), 3000000)
    flyTo(lon, lat, resolved)
  },
  viewBounds: currentViewBounds,
  camera: () => ({ longitude: camera.value.longitude, latitude: camera.value.latitude, height: camera.value.height }),
  setMonth: (month) => {
    monsoonStore.setMonth(month)
    monsoonStore.setPanelOpen(true)
  },
  dropMarker: markers.dropMarker,
  terrainAt: (lon, lat) => {
    const currentViewer = viewer.value
    if (!currentViewer || currentViewer.isDestroyed()) return null
    return currentViewer.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(lon, lat)) ?? null
  }
})

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

function handleTerrainChange(id: string): void {
  setTerrain(id)
}

function handleTerrainExaggeration(value: number): void {
  setTerrainExaggeration(value)
}

function handleTerrainLighting(value: boolean): void {
  setTerrainLighting(value)
}

function handleCacheChange(value: boolean): void {
  store.setTileCacheEnabled(value)
}

async function handleCredentialSave(id: string, apiKey: string, securityKey?: string): Promise<void> {
  try {
    const status = await window.guEarth.settings.setProviderApiKey(id, apiKey)
    store.setCredentialStatus(id, status)
    if (securityKey) {
      const securityStatus = await window.guEarth.settings.setProviderApiKey(`${id}-sk`, securityKey)
      store.setCredentialStatus(`${id}-sk`, securityStatus)
    }
  } catch {
    store.setGlobeError('密钥保存失败')
  }
}

async function handleCredentialClear(id: string): Promise<void> {
  try {
    const status = await window.guEarth.settings.clearProviderApiKey(id)
    store.setCredentialStatus(id, status)
    const securityStatus = await window.guEarth.settings.clearProviderApiKey(`${id}-sk`)
    store.setCredentialStatus(`${id}-sk`, securityStatus)
  } catch {
    store.setGlobeError('密钥清除失败')
  }
}

function handleHome(): void {
  flyTo(105, 35, 15000000)
}

function handleRetry(): void {
  location.reload()
}

function handleLevelViewToggle(): void {
  toggleLevelView()
}
</script>

<template>
  <div class="app">
    <div ref="globeContainer" class="globe"></div>
    <GlobeToolbar
      :active="toolbarActive"
      @open-layers="handleOpenLayers"
      @open-terrain-lab="terrainLabStore.setPanelOpen(true)"
      @open-draw="drawStore.setPanelOpen(true)"
      @open-monsoon="monsoonStore.setPanelOpen(true)"
      @open-solar="solarStore.setPanelOpen(true)"
      @open-tectonic="tectonicStore.setPanelOpen(true)"
      @open-assistant="assistantStore.setOpen(true)"
      @home="handleHome"
    />
    <CameraStatus :camera="camera" />
    <LevelViewSwitcher
      :level-view-active="levelViewActive"
      :visible="levelSwitcherVisible"
      @toggle="handleLevelViewToggle"
    />
    <LayerPanel
      :open="isLayerPanelOpen"
      :layers="layers"
      :selected-layer-id="selectedLayerId"
      :error="globeError"
      :terrain-error="terrainError"
      :loading="!isGlobeReady"
      :terrain-provider-id="terrainProviderId"
      :terrain-exaggeration="terrainExaggeration"
      :terrain-lighting="terrainLighting"
      :tile-cache-enabled="tileCacheEnabled"
      :provider-credentials="providerCredentials"
      @close="handleClosePanel"
      @select="handleSelectLayer"
      @opacity="handleOpacityChange"
      @retry="handleRetry"
      @terrain="handleTerrainChange"
      @terrain-exaggeration="handleTerrainExaggeration"
      @terrain-lighting="handleTerrainLighting"
      @cache="handleCacheChange"
      @credential-save="handleCredentialSave"
      @credential-clear="handleCredentialClear"
    />
    <TerrainLabPanel />
    <DrawPanel />
    <MonsoonPanel />
    <SolarPanel />
    <TectonicPanel />
    <AssistantPanel />
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
