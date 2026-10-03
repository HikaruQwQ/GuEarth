<script setup lang="ts">
import { ref, toRaw } from 'vue'
import * as Cesium from 'cesium'
import { CloseOutlined } from '@ant-design/icons-vue'

const emit = defineEmits<{ close: [] }>()
const props = defineProps<{ viewer?: Cesium.Viewer }>()

interface LandformSite {
  id: string
  name: string
  type: string
  color: string
  longitude: number
  latitude: number
  height: number
  features: string[]
  cause: string
}

const sites: LandformSite[] = [
  {
    id: 'karst',
    name: '桂林 · 喀斯特地貌',
    type: '流水溶蚀（湿蚀）',
    color: '#52c41a',
    longitude: 110.5,
    latitude: 25.0,
    height: 70000,
    features: ['峰林、峰丛、孤峰，溶洞与地下河', '地面崎岖，地表水易渗漏', '“山水甲天下”的塔状山体'],
    cause: '石灰岩（可溶性岩石）+ 湿热气候：流水对碳酸盐岩长期溶蚀与沉积，形成地上峰林、地下溶洞的双重喀斯特景观。云贵高原为上游，多溶洞洼地；广西盆地边缘水流集中，峰林发育最典型。'
  },
  {
    id: 'yardang',
    name: '敦煌 · 雅丹地貌',
    type: '风力侵蚀（风蚀）',
    color: '#fa8c16',
    longitude: 92.9,
    latitude: 40.4,
    height: 90000,
    features: ['沟垄相间、垄脊与沟槽定向排列', '“魔鬼城”式残丘、风蚀蘑菇、风蚀柱', '地表干旱、植被稀少'],
    cause: '干旱区风力侵蚀：古湖沉积的固结较差的泥岩、粉砂岩，经受盛行风长期吹蚀与磨蚀，软弱处形成沟槽、坚硬处残留为垄岗，延伸方向与盛行风向一致。'
  },
  {
    id: 'glacial',
    name: '贡嘎山海螺沟 · 冰川地貌',
    type: '冰川侵蚀与堆积',
    color: '#1677ff',
    longitude: 101.95,
    latitude: 29.6,
    height: 100000,
    features: ['U 形谷（槽谷）、角峰、刃脊', '冰碛垄、冰碛湖等堆积地貌', '现代海洋性冰川伸入森林带'],
    cause: '高山高纬地区冰川运动：冰川体对谷地底部与两侧强烈刨蚀、磨蚀，把 V 形谷改造为 U 形谷；冰川消融后携带的碎屑（冰碛物）堆积形成冰碛地貌。'
  },
  {
    id: 'coastal',
    name: '大连金石滩 · 海岸地貌',
    type: '海浪侵蚀与堆积',
    color: '#13c2c2',
    longitude: 122.05,
    latitude: 39.08,
    height: 60000,
    features: ['海蚀崖、海蚀拱桥、海蚀柱', '邻近海湾发育沙滩等堆积地貌', '基岩海岸与沙质海岸并存'],
    cause: '海浪长期拍击基岩海岸，软弱处被掏蚀形成海蚀穴→海蚀洞→海蚀拱桥→海蚀柱的演变链；被侵蚀的泥沙在波浪动能减弱的海湾堆积，形成沙滩与沙嘴。'
  },
  {
    id: 'loess',
    name: '黄土高原 · 黄土地貌',
    type: '流水侵蚀（湿蚀）+ 风力堆积',
    color: '#faad14',
    longitude: 109.5,
    latitude: 36.5,
    height: 400000,
    features: ['塬、梁、峁千沟万壑', '水土流失严重，河流含沙量大', '黄土直立性强、多孔隙'],
    cause: '风力从西北内陆搬运的粉尘堆积形成厚层黄土；黄土疏松多孔，夏季暴雨冲刷形成密集沟壑，塬被切割为梁、峁，是“风成黄土、流水塑造”的组合地貌。'
  }
]

const activeId = ref<string>('karst')
const active = ref<LandformSite>(sites[0])

function selectSite(site: LandformSite): void {
  activeId.value = site.id
  active.value = site
  const current = props.viewer && !props.viewer.isDestroyed() ? toRaw(props.viewer) : undefined
  current?.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(site.longitude, site.latitude, site.height), duration: 1.4 })
}
</script>

<template>
  <div class="guide-panel" role="group" aria-label="典型地貌识别">
    <div class="panel-header">
      <span class="panel-title">典型地貌识别</span>
      <a-button type="text" size="small" aria-label="关闭典型地貌识别" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </div>
    <div class="site-list">
      <button v-for="site in sites" :key="site.id" class="site-item" :class="{ 'site-active': site.id === activeId }" @click="selectSite(site)">
        <span class="site-dot" :style="{ background: site.color }"></span>
        <span class="site-name">{{ site.name }}</span>
        <span class="site-type">{{ site.type }}</span>
      </button>
    </div>
    <div class="cause-title">成因机制</div>
    <div class="cause-text">{{ active.cause }}</div>
    <div class="cause-title">识别要点</div>
    <div v-for="feature in active.features" :key="feature" class="fact">· {{ feature }}</div>
    <div class="panel-note">点击任一地貌即可在数字地球上飞往真实地点实地观察——请留意影像中的形态特征并与识别要点对照。</div>
  </div>
</template>

<style scoped>
.guide-panel {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.site-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.site-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: 1px solid rgba(5, 5, 5, 0.06);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.02);
  cursor: pointer;
  text-align: left;
}

.site-active {
  border-color: #1677ff;
  background: rgba(22, 119, 255, 0.06);
}

.site-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.site-name {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  font-weight: 600;
}

.site-type {
  margin-left: auto;
  color: rgba(0, 0, 0, 0.45);
  font-size: 11px;
}

.cause-title {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.cause-text {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 19px;
}

.fact {
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
