<script setup lang="ts">
import { computed } from 'vue'
import { Button, Tooltip } from 'ant-design-vue'
import { AimOutlined, EyeOutlined } from '@ant-design/icons-vue'

const props = defineProps<{
  levelViewActive: boolean
  visible: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const buttonIcon = computed(() => (props.levelViewActive ? EyeOutlined : AimOutlined))
const tooltipText = computed(() => (props.levelViewActive ? '恢复俯视视角' : '平视 3D 地形'))
const ariaLabel = computed(() => tooltipText.value)

function handleClick(): void {
  emit('toggle')
}
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="level-view-switcher">
      <Tooltip :title="tooltipText" placement="left">
        <Button
          :type="levelViewActive ? 'primary' : 'default'"
          shape="circle"
          size="large"
          :aria-label="ariaLabel"
          @click="handleClick"
        >
          <template #icon><component :is="buttonIcon" /></template>
        </Button>
      </Tooltip>
    </div>
  </Transition>
</template>

<style scoped>
.level-view-switcher {
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
