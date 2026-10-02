<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{
  title: string
  unit: string
  yMax: number
  points: Array<{ lat: number; value: number }>
}>()

const canvas = ref<HTMLCanvasElement>()
const width = 398
const height = 132
const padding = { left: 38, right: 10, top: 10, bottom: 20 }

function draw(): void {
  const element = canvas.value
  if (!element || props.points.length < 2) return
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
  const latMin = -90
  const latMax = 90
  const xFor = (lat: number): number => padding.left + ((lat - latMin) / (latMax - latMin)) * plotWidth
  const yFor = (value: number): number => padding.top + (1 - value / (props.yMax || 1)) * plotHeight
  ctx.strokeStyle = 'rgba(5,5,5,0.08)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotHeight * i) / 4
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()
  }
  for (const lat of [-60, -30, 0, 30, 60]) {
    ctx.beginPath()
    ctx.moveTo(xFor(lat), padding.top)
    ctx.lineTo(xFor(lat), height - padding.bottom)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(xFor(props.points[0].lat), yFor(props.points[0].value))
  props.points.forEach((point) => ctx.lineTo(xFor(point.lat), yFor(point.value)))
  ctx.strokeStyle = '#1677ff'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.font = '10px Consolas, monospace'
  for (let i = 0; i <= 2; i++) {
    const value = (props.yMax * i) / 2
    ctx.fillText(`${Math.round(value)}`, 6, yFor(value) + 3)
  }
  for (const lat of [-60, -30, 0, 30, 60]) {
    const label = `${lat}°`
    ctx.fillText(label, xFor(lat) - label.length * 2.5, height - 8)
  }
}

onMounted(draw)
watch(() => [props.points, props.yMax], draw, { deep: true })
</script>

<template>
  <div class="latitude-chart">
    <div class="chart-head"><span class="chart-title">{{ title }}</span><span class="chart-unit">{{ unit }}</span></div>
    <canvas ref="canvas" :style="{ width: `${width}px`, height: `${height}px` }" :aria-label="title" />
  </div>
</template>

<style scoped>
.latitude-chart {
  margin-top: 8px;
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chart-title {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 20px;
}

.chart-unit {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
}

canvas {
  display: block;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 6px;
}
</style>
