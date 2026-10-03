<script setup lang="ts">
import { ref, toRaw } from 'vue'
import * as Cesium from 'cesium'
import { CloseOutlined } from '@ant-design/icons-vue'

const emit = defineEmits<{ close: [] }>()
const props = defineProps<{ viewer?: Cesium.Viewer }>()

interface ChainStage {
  id: string
  name: string
  force: string
  description: string
  color: string
  site?: { label: string; longitude: number; latitude: number; height: number }
}

const stages: ChainStage[] = [
  {
    id: 'weathering',
    name: '风化作用',
    force: '温差、冻融、水、生物',
    description: '岩石原地被破坏、崩解碎裂，不发生位移。花岗岩球状风化、石灰岩化学溶蚀都属于风化。',
    color: '#faad14',
    site: { label: '黄山球状风化', longitude: 118.17, latitude: 30.13, height: 30000 }
  },
  {
    id: 'erosion',
    name: '侵蚀作用',
    force: '流水、风力、冰川、海浪',
    description: '风化产物与岩石被外力破坏并搬离原地：流水下切成 V 形谷、风蚀雅丹、冰川刨蚀 U 形谷、海浪蚀出海蚀崖。',
    color: '#fa8c16',
    site: { label: '虎跳峡流水侵蚀', longitude: 100.05, latitude: 27.25, height: 45000 }
  },
  {
    id: 'transportation',
    name: '搬运作用',
    force: '流水、风力、冰川',
    description: '外力将碎屑物质搬运离开：河流挟带泥沙（黄河“一碗水半碗沙”）、风沙运移、冰川携带冰碛物。',
    color: '#722ed1',
    site: { label: '黄河中游泥沙搬运', longitude: 110.5, latitude: 35.5, height: 400000 }
  },
  {
    id: 'deposition',
    name: '堆积作用',
    force: '流速/风速降低、冰川消融',
    description: '外力减弱，物质沉积：山前冲积扇、河流三角洲、风积沙丘、冰碛垄。粒径大的先沉积、小的后沉积，出现分选性。',
    color: '#13c2c2',
    site: { label: '长江三角洲堆积', longitude: 120.7, latitude: 31.6, height: 300000 }
  },
  {
    id: 'lithification',
    name: '固结成岩',
    force: '压实、胶结',
    description: '松散堆积物经漫长地质时期压实胶结，重新变成沉积岩（砂岩、页岩、石灰岩），完成岩石循环。',
    color: '#595959'
  }
]

const activeId = ref('weathering')

function selectStage(stage: ChainStage): void {
  activeId.value = stage.id
}

function flyToSite(stage: ChainStage): void {
  if (!stage.site) return
  const current = props.viewer && !props.viewer.isDestroyed() ? toRaw(props.viewer) : undefined
  current?.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(stage.site.longitude, stage.site.latitude, stage.site.height),
    duration: 1.4
  })
}
</script>

<template>
  <div class="exogenic-panel" role="group" aria-label="外力作用过程">
    <div class="panel-header">
      <span class="panel-title">外力作用过程</span>
      <a-button type="text" size="small" aria-label="关闭外力作用过程" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </div>
    <div class="chain">
      <template v-for="(stage, index) in stages" :key="stage.id">
        <button class="chain-node" :class="{ 'chain-active': stage.id === activeId }" :style="{ borderColor: stage.color }" @click="selectStage(stage)">
          <span class="chain-dot" :style="{ background: stage.color }"></span>
          <span class="chain-name">{{ stage.name }}</span>
        </button>
        <span v-if="index < stages.length - 1" class="chain-arrow">→</span>
      </template>
    </div>
    <div class="stage-card" v-for="stage in stages.filter((item) => item.id === activeId)" :key="stage.id">
      <div class="stage-force">主要动力：{{ stage.force }}</div>
      <div class="stage-desc">{{ stage.description }}</div>
      <a-button v-if="stage.site" size="small" @click="flyToSite(stage)">在地球上查看：{{ stage.site.label }}</a-button>
    </div>
    <div class="panel-note">外力作用与内力作用共同塑造地表形态：内力作用（地壳运动、岩浆活动、变质作用）奠定宏观格局并使地表高低不平，外力作用则削高填低、使地表趋于平缓。湿润半湿润区以流水作用为主，干旱半干旱区以风力作用为主，高纬高山以冰川作用为主，沿海以海浪作用为主。</div>
  </div>
</template>

<style scoped>
.exogenic-panel {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 380px;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
  padding: 12px 16px 16px;
  background: #ffffff;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 8px;
  box-shadow: var(--ant-box-shadow-secondary, 0 4px 12px rgba(0, 0, 0, 0.08));
  z-index: 10;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title {
  margin-right: auto;
  color: rgba(0, 0, 0, 0.88);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.chain {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.chain-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border: 1.5px solid rgba(5, 5, 5, 0.1);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.02);
  cursor: pointer;
}

.chain-active {
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.15);
}

.chain-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.chain-name {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  font-weight: 600;
}

.chain-arrow {
  color: rgba(0, 0, 0, 0.35);
  font-size: 13px;
}

.stage-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
}

.stage-force {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.stage-desc {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 19px;
}

.panel-note {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 19px;
}
</style>
