<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'

const props = defineProps<{ ready: boolean }>()
const emit = defineEmits<{ stepChange: [step: number] }>()

const completedKey = 'guearth.first-use-guide.completed.v1'
const open = ref(false)
const current = ref(0)
const completed = ref(readCompleted())
let transitioning = false
const guideLocale = {
  ...zhCN,
  Tour: {
    ...zhCN.Tour,
    Finish: '完成'
  }
}

function readCompleted(): boolean {
  try {
    return window.localStorage.getItem(completedKey) === 'true'
  } catch {
    return false
  }
}

function getTarget(name: string): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-guide-target="${name}"]`) ?? document.body
}

const steps = [
  {
    title: '初始视角，重新认识地球🌏',
    description: '返回默认全球视角。靠近地表后，可切换平视 3D 地形；发现新版本时，此处会显示更新入口。',
    target: () => getTarget('home'),
    placement: 'top'
  },
  {
    title: '地图与地形图层🗺️',
    description: '切换底图、调整 3D 地形与光照。高德或百度的地图搜索密钥也在此处配置。',
    target: () => getTarget('layers'),
    placement: 'top'
  },
  {
    title: '地理实验室🧪',
    description: '打开太阳、天气、地貌、海洋等教学实验与专题图层。',
    target: () => getTarget('lab'),
    placement: 'top'
  },
  {
    title: '标注管理📌',
    description: '查看已保存的标注和文件夹，并编辑或定位到对应标注。',
    target: () => getTarget('annotations'),
    placement: 'top'
  },
  {
    title: '绘制与清除✏️',
    description: '支持绘制点、线（测距）、多边形（测面积）、箭头和文本。清除按钮可删除全部标注。',
    target: () => getTarget('drawing-tools'),
    placement: 'top'
  },
  {
    title: '搜索地点🔎',
    description: '在左上角输入地点并选择搜索结果，即可飞往目标。使用搜索前，需配置高德或百度 API 密钥。',
    target: () => getTarget('place-search'),
    placement: 'bottomLeft'
  },
  {
    title: '配置地图搜索密钥🔑',
    description: '选择高德并填写 Web 服务 API Key，或选择百度并填写 AK，然后保存。配置完成后即可搜索地点。',
    target: () => getTarget('provider-credentials'),
    placement: 'left'
  },
  {
    title: 'EOQ 智能助手🤖',
    description: '点击此处打开 EOQ 助手。使用 AI 问答前，需要先添加模型供应商。',
    target: () => getTarget('assistant'),
    placement: 'top'
  },
  {
    title: '配置 AI 模型🧠',
    description: '如需使用 AI，请点击“添加供应商”，填写接口地址和 API Key，再添加模型、设为默认并保存。API Key 保存在本机安全存储中。',
    target: () => getTarget('ai-provider-settings'),
    placement: 'right'
  }
]

function start(): void {
  current.value = 0
  open.value = true
  emit('stepChange', 0)
}

async function handleChange(nextStep: number): Promise<void> {
  if (transitioning) return
  transitioning = true
  emit('stepChange', nextStep)
  await nextTick()
  if ([6, 7, 8].includes(nextStep) || [6, 7, 8].includes(current.value)) {
    await new Promise((resolve) => window.setTimeout(resolve, 320))
  }
  current.value = nextStep
  await nextTick()
  transitioning = false
}

function finish(): void {
  open.value = false
  completed.value = true
  try {
    window.localStorage.setItem(completedKey, 'true')
  } catch {
    return
  }
}

watch(() => props.ready, (ready) => {
  if (ready && !completed.value && !open.value) start()
}, { immediate: true })

defineExpose({ start })
</script>

<template>
  <a-config-provider :locale="guideLocale">
    <a-tour
      :open="open"
      :current="current"
      :steps="steps"
      :z-index="1200"
      :mask="{ color: 'rgba(0, 0, 0, 0.45)' }"
      @change="handleChange"
      @close="finish"
      @finish="finish"
    />
  </a-config-provider>
</template>
