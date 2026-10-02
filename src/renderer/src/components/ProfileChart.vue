<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { ProfileSample } from '@renderer/utils/geo'

const props = defineProps<{
  profile: ProfileSample[]
}>()

const canvas = ref<HTMLCanvasElement>()
const width = 296
const height = 168
const padding = { left: 48, right: 12, top: 14, bottom: 24 }

function draw(): void {
  const element = canvas.value
  if (!element || props.profile.length < 2) return
  const ratio = window.devicePixelRatio || 1
  element.width = width * ratio
  element.height = height * ratio
  const ctx = element.getContext('2d')
  if (!ctx) return
  ctx.scale(ratio, ratio)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maxDistance = props.profile[props.profile.length - 1].distanceKm || 1
  const elevations = props.profile.map((sample) => sample.elevation)
  const rawMin = Math.min(...elevations)
  const rawMax = Math.max(...elevations)
  const elevationPad = (rawMax - rawMin) * 0.15 || 40
  const minElevation = Math.max(0, rawMin - elevationPad)
  const maxElevation = rawMax + elevationPad
  const xFor = (distance: number): number => padding.left + (distance / maxDistance) * plotWidth
  const yFor = (elevation: number): number => padding.top + (1 - (elevation - minElevation) / (maxElevation - minElevation || 1)) * plotHeight
  ctx.strokeStyle = 'rgba(5,5,5,0.08)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotHeight * i) / 4
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()
  }
  for (let i = 0; i <= 4; i++) {
    const x = padding.left + (plotWidth * i) / 4
    ctx.beginPath()
    ctx.moveTo(x, padding.top)
    ctx.lineTo(x, height - padding.bottom)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(xFor(props.profile[0].distanceKm), yFor(props.profile[0].elevation))
  props.profile.forEach((sample) => ctx.lineTo(xFor(sample.distanceKm), yFor(sample.elevation)))
  ctx.lineTo(xFor(maxDistance), height - padding.bottom)
  ctx.lineTo(xFor(0), height - padding.bottom)
  ctx.closePath()
  ctx.fillStyle = 'rgba(22,119,255,0.14)'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(xFor(props.profile[0].distanceKm), yFor(props.profile[0].elevation))
  props.profile.forEach((sample) => ctx.lineTo(xFor(sample.distanceKm), yFor(sample.elevation)))
  ctx.strokeStyle = '#1677ff'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.font = '10px Consolas, monospace'
  for (let i = 0; i <= 2; i++) {
    const elevation = minElevation + ((maxElevation - minElevation) * i) / 2
    const y = yFor(elevation)
    ctx.fillText(`${Math.round(elevation)}m`, 4, y + 3)
  }
  ctx.fillText('0', padding.left - 4, height - 8)
  const midLabel = `${(maxDistance / 2).toFixed(1)}km`
  ctx.fillText(midLabel, padding.left + plotWidth / 2 - midLabel.length * 2, height - 8)
  const maxLabel = `${maxDistance.toFixed(1)}km`
  ctx.fillText(maxLabel, width - padding.right - maxLabel.length * 6, height - 8)
}

onMounted(draw)
watch(() => props.profile, draw, { deep: true })
</script>

<template>
  <canvas ref="canvas" class="profile-chart" :style="{ width: `${width}px`, height: `${height}px` }" aria-label="剖面高程图" />
</template>

<style scoped>
.profile-chart {
  display: block;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 6px;
  margin-top: 8px;
}
</style>
