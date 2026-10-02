<script setup lang="ts">
import { computed } from 'vue'
import { Button, Tooltip } from 'ant-design-vue'
import { GlobalOutlined, EnvironmentOutlined } from '@ant-design/icons-vue'

const props = defineProps<{
  camera: { longitude: number; latitude: number; height: number }
  sceneMode: '2D' | '3D'
  visible: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const isGlobeMode = computed(() => props.sceneMode === '3D')
const buttonIcon = computed(() => isGlobeMode.value ? EnvironmentOutlined : GlobalOutlined)
const tooltipText = computed(() => isGlobeMode.value ? '切换到平面地图' : '切换到地球视角')

function handleClick(): void {
  emit('toggle')
}
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="scene-mode-switcher">
      <Tooltip :title="tooltipText" placement="left">
        <Button
          type="default"
          :icon="buttonIcon"
          shape="circle"
          size="large"
          @click="handleClick"
        />
      </Tooltip>
    </div>
  </Transition>
</template>

<style scoped>
.scene-mode-switcher {
  position: fixed;
  right: 16px;
  bottom: 80px;
  z-index: 100;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
