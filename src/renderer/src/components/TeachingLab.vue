<script setup lang="ts">
import { CloseOutlined } from '@ant-design/icons-vue'
import { thematicLayerCatalog, useClimateStore, type ThematicLayerId } from '@renderer/stores/climate'
import { useSolarStore, type MotionPanel as SolarMotionPanel } from '@renderer/stores/solar'
import { useAtmosphereStore, type AtmospherePanel } from '@renderer/stores/atmosphere'
import { useDrawingStore } from '@renderer/stores/drawing'

interface LabEntry {
  key: string
  name: string
  description: string
  active: () => boolean
  toggle: () => void
}

interface LabChapter {
  id: string
  title: string
  entries: LabEntry[]
}

defineProps<{ open: boolean }>()

const emit = defineEmits<{ close: [] }>()

const climateStore = useClimateStore()
const solarStore = useSolarStore()
const atmosphereStore = useAtmosphereStore()
const drawingStore = useDrawingStore()

function layerEntry(id: ThematicLayerId): LabEntry {
  const layer = thematicLayerCatalog.find((item) => item.id === id)
  return {
    key: id,
    name: layer?.name ?? id,
    description: layer?.description ?? '',
    active: () => climateStore.overlays[id],
    toggle: () => climateStore.setOverlay(id, !climateStore.overlays[id])
  }
}

function solarPanelEntry(panel: SolarMotionPanel, name: string, description: string): LabEntry {
  return {
    key: panel,
    name,
    description,
    active: () => solarStore.motionPanel === panel,
    toggle: () => {
      atmosphereStore.setPanel(null)
      solarStore.setMotionPanel(solarStore.motionPanel === panel ? null : panel)
    }
  }
}

function atmospherePanelEntry(panel: AtmospherePanel, name: string, description: string): LabEntry {
  return {
    key: panel,
    name,
    description,
    active: () => atmosphereStore.panel === panel,
    toggle: () => {
      solarStore.setMotionPanel(null)
      atmosphereStore.setPanel(atmosphereStore.panel === panel ? null : panel)
    }
  }
}

const chapters: LabChapter[] = [
  {
    id: 'earth-motion',
    title: '第一章 · 地球的运动',
    entries: [
      {
        key: 'solar',
        name: '太阳光照与晨昏线',
        description: '调日期与时刻，演示昼夜交替与极昼极夜',
        active: () => solarStore.active,
        toggle: () => solarStore.setActive(!solarStore.active)
      },
      solarPanelEntry('solar-path', '太阳视运动轨迹', '站在地面看天空：日出日落方位与正午太阳方位'),
      solarPanelEntry('obliquity', '黄赤交角可调探究', '拖动交角，观察直射点范围与五带变化'),
      solarPanelEntry('rotation-speed', '自转速度与周期', '角速度线速度随纬度变化、恒星日与太阳日'),
      {
        key: 'temperature-zones',
        name: '五带与直射点回归',
        description: '五带划分与界线，直射点随日期时刻移动',
        active: () => climateStore.overlays['temperature-zones'],
        toggle: () => {
          const next = !climateStore.overlays['temperature-zones']
          climateStore.setOverlay('temperature-zones', next)
          if (next) solarStore.setActive(true)
        }
      },
      {
        key: 'timezone',
        name: '时区对比',
        description: '在地球上选取两地，对比地方时与区时',
        active: () => drawingStore.activeTool === 'timezone',
        toggle: () => drawingStore.setActiveTool(drawingStore.activeTool === 'timezone' ? null : 'timezone')
      },
      layerEntry('coriolis-demo')
    ]
  },
  {
    id: 'atmosphere',
    title: '第二章 · 地球上的大气',
    entries: [
      atmospherePanelEntry('circulation', '热力环流', '海陆风、山谷风、城市风动画'),
      atmospherePanelEntry('heating', '大气受热过程', '削弱作用与保温作用（温室效应）'),
      atmospherePanelEntry('layers', '大气垂直分层', '各层高度-气温曲线与特征'),
      layerEntry('typhoon'),
      layerEntry('pressure-belts'),
      layerEntry('wind-particles'),
      layerEntry('summer-monsoon'),
      layerEntry('winter-monsoon'),
      layerEntry('rain-belt'),
      layerEntry('frontal-cyclone'),
      layerEntry('koppen-zones'),
      layerEntry('climate-zones')
    ]
  },
  {
    id: 'water',
    title: '第三章 · 地球上的水',
    entries: [layerEntry('ocean-currents')]
  },
  {
    id: 'landform',
    title: '第四章 · 地表形态的塑造',
    entries: [layerEntry('plate-tectonics')]
  }
]

function selectEntry(entry: LabEntry): void {
  entry.toggle()
  emit('close')
}
</script>

<template>
  <div v-if="open" class="teaching-lab" role="dialog" aria-label="地理实验室">
    <div class="lab-header">
      <span class="lab-title">地理实验室</span>
      <a-button type="text" size="small" aria-label="关闭地理实验室" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </div>
    <div class="lab-grid">
      <section v-for="chapter in chapters" :key="chapter.id" class="lab-chapter">
        <div class="lab-chapter-title">{{ chapter.title }}</div>
        <button
          v-for="entry in chapter.entries"
          :key="entry.key"
          type="button"
          class="lab-entry"
          :class="{ active: entry.active() }"
          @click="selectEntry(entry)"
        >
          <span class="lab-entry-dot" aria-hidden="true"></span>
          <span class="lab-entry-copy">
            <span class="lab-entry-name">{{ entry.name }}</span>
            <span class="lab-entry-desc">{{ entry.description }}</span>
          </span>
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.teaching-lab {
  position: absolute;
  bottom: 76px;
  left: 50%;
  transform: translateX(-50%);
  width: min(640px, calc(100vw - 48px));
  max-height: min(440px, calc(100vh - 200px));
  overflow-y: auto;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  box-shadow: var(--ant-box-shadow-secondary, 0 4px 12px rgba(0, 0, 0, 0.08));
  z-index: 12;
}

.lab-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.lab-title {
  color: rgba(0, 0, 0, 0.88);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.lab-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 24px;
}

.lab-chapter {
  display: flex;
  flex-direction: column;
}

.lab-chapter-title {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
  margin: 6px 0 2px;
}

.lab-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.lab-entry:hover {
  background: rgba(0, 0, 0, 0.04);
}

.lab-entry-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid rgba(0, 0, 0, 0.25);
}

.lab-entry.active .lab-entry-dot {
  border-color: #1677ff;
  background: #1677ff;
}

.lab-entry-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.lab-entry-name {
  color: rgba(0, 0, 0, 0.88);
  font-size: 13px;
  line-height: 20px;
}

.lab-entry.active .lab-entry-name {
  color: #1677ff;
  font-weight: 600;
}

.lab-entry-desc {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
