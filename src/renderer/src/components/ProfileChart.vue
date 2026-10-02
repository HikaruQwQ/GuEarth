<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { drawProfileChart } from '@renderer/utils/profileChart'
import type { ProfileSample } from '@renderer/utils/geo'

const props = defineProps<{
  profile: ProfileSample[]
}>()

const canvas = ref<HTMLCanvasElement>()
const width = 296
const height = 168

function draw(): void {
  const element = canvas.value
  if (!element || props.profile.length < 2) return
  const ratio = window.devicePixelRatio || 1
  element.width = width * ratio
  element.height = height * ratio
  const ctx = element.getContext('2d')
  if (!ctx) return
  ctx.scale(ratio, ratio)
  drawProfileChart(ctx, props.profile, width, height)
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
