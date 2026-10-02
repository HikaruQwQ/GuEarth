<script setup lang="ts">
import type { CameraReadout } from '@renderer/stores/globe'

defineProps<{
  camera: CameraReadout
}>()

function formatCoordinate(value: number, isLongitude: boolean): string {
  const abs = Math.abs(value)
  const direction = isLongitude ? (value >= 0 ? 'E' : 'W') : value >= 0 ? 'N' : 'S'
  return `${abs.toFixed(4)}°${direction}`
}

function formatHeight(height: number): string {
  if (height > 1000000) {
    return `${(height / 1000000).toFixed(2)} Mm`
  } else if (height > 1000) {
    return `${(height / 1000).toFixed(2)} km`
  } else {
    return `${height.toFixed(0)} m`
  }
}

function formatAngle(angle: number): string {
  return `${angle.toFixed(1)}°`
}
</script>

<template>
  <div class="camera-status">
    <div class="status-item">
      <span class="label">Lon</span>
      <span class="value">{{ formatCoordinate(camera.longitude, true) }}</span>
    </div>
    <div class="status-item">
      <span class="label">Lat</span>
      <span class="value">{{ formatCoordinate(camera.latitude, false) }}</span>
    </div>
    <div class="status-item">
      <span class="label">Alt</span>
      <span class="value">{{ formatHeight(camera.height) }}</span>
    </div>
    <div class="status-item">
      <span class="label">Heading</span>
      <span class="value">{{ formatAngle(camera.heading) }}</span>
    </div>
    <div class="status-item">
      <span class="label">Pitch</span>
      <span class="value">{{ formatAngle(camera.pitch) }}</span>
    </div>
  </div>
</template>

<style scoped>
.camera-status {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  gap: 12px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  padding: 8px 12px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  line-height: 20px;
  color: rgba(0, 0, 0, 0.45);
}

.value {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 20px;
  color: rgba(0, 0, 0, 0.88);
}
</style>
