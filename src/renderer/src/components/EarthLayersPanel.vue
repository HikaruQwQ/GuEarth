<script setup lang="ts">
import { computed, ref } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'

const emit = defineEmits<{ close: [] }>()

type LayerId = 'crust' | 'mantle' | 'outer-core' | 'inner-core'

interface LayerMeta {
  name: string
  depth: string
  color: string
  facts: string[]
}

const layers: Record<LayerId, LayerMeta> = {
  crust: {
    name: '地壳',
    depth: '平均约 17 千米（大陆 35~40 千米、大洋 5~10 千米）',
    color: '#8c6d46',
    facts: ['由岩石组成的坚硬外壳，大陆地壳厚、大洋地壳薄', '硅铝层（上层）与硅镁层（下层），大洋地壳往往缺失硅铝层', '地震波速度变化——莫霍面（莫霍洛维奇不连续面）是其与地幔的分界']
  },
  mantle: {
    name: '地幔',
    depth: '17~2900 千米',
    color: '#d48265',
    facts: ['占地球体积约 80%，上地幔上部存在软流层（软流圈），一般认为是岩浆的主要发源地', '岩石圈 = 地壳 + 上地幔顶部（软流层以上），在软流层上“漂移”运动，是板块构造学说的基础', '下地幔物质致密、温度压力极高；与地核的分界为古登堡面']
  },
  'outer-core': {
    name: '外地核',
    depth: '2900~5150 千米',
    color: '#f5a623',
    facts: ['横波（S 波）不能通过外地核，推断其为液态（熔融态铁镍）', '液态金属铁镍的流动形成地球磁场', '与内地核的分界为莱曼面（5150 千米）']
  },
  'inner-core': {
    name: '内地核',
    depth: '5150~6371 千米',
    color: '#fa541c',
    facts: ['纵波在内地核传播时速度加快，推断其为固态（超高压下铁镍固化）', '温度约 4000~6000℃，与太阳表面相当', '地心压力约为大气压的 300 多万倍']
  }
}

const active = ref<LayerId>('crust')
const meta = computed(() => layers[active.value])

const arcs: Array<{ id: LayerId; r: number }> = [
  { id: 'inner-core', r: 46 },
  { id: 'outer-core', r: 96 },
  { id: 'mantle', r: 148 },
  { id: 'crust', r: 170 }
]

function layerTop(id: LayerId): number {
  return arcs.find((arc) => arc.id === id)?.r ?? 170
}

const boundaryNotes = [
  '莫霍面（地下约 17 千米）：纵波与横波速度都明显加快——地壳与地幔的分界',
  '古登堡面（地下约 2900 千米）：纵波速度骤降、横波消失——地幔与外地核的分界，据此推断外地核为液态',
  '地震波：纵波（P 波）可通过固液气三态，横波（S 波）只能通过固体，是研究地球内部的“探照灯”'
]
</script>

<template>
  <div class="layers-panel" role="group" aria-label="地球圈层结构">
    <div class="panel-header">
      <span class="panel-title">地球的圈层结构</span>
      <a-button type="text" size="small" aria-label="关闭地球圈层结构" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </div>
    <svg viewBox="0 0 340 210" class="earth-svg" role="img" aria-label="地球内部圈层切球剖面示意">
      <g v-for="arc in [...arcs].reverse()" :key="arc.id">
        <path
          :d="`M ${170 - arc.r} 190 A ${arc.r} ${arc.r} 0 0 1 ${170 + arc.r} 190 Z`"
          :fill="layers[arc.id].color"
          :opacity="active === arc.id ? 0.92 : 0.5"
          stroke="rgba(0,0,0,0.2)"
          stroke-width="1"
          style="cursor: pointer"
          @click="active = arc.id"
        />
      </g>
      <line x1="0" y1="190" x2="340" y2="190" stroke="rgba(0,0,0,0.4)" stroke-width="1.5" />
      <g font-size="11" font-family='"Microsoft YaHei", "PingFang SC", sans-serif'>
        <text :x="170 - layerTop('mantle') / 2 - 10" y="196" text-anchor="middle" fill="rgba(0,0,0,0.65)">莫霍面</text>
        <text :x="170 - layerTop('outer-core') / 2" y="196" text-anchor="middle" fill="rgba(0,0,0,0.65)">古登堡面</text>
        <text x="170" y="186" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-weight="600">内地核</text>
        <text x="170" y="150" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-weight="600">外地核（横波不能通过）</text>
        <text x="170" y="106" text-anchor="middle" fill="rgba(255,255,255,0.95)" font-weight="600">地幔（软流层）</text>
        <text x="170" y="34" text-anchor="middle" fill="rgba(0,0,0,0.75)" font-weight="600">地壳</text>
        <text x="336" y="206" text-anchor="end" fill="rgba(0,0,0,0.45)">剖面比例经夸张示意（真实地壳仅约地球半径 1/375）</text>
      </g>
    </svg>
    <div class="layer-tabs">
      <button v-for="(value, id) in layers" :key="id" class="layer-tab" :class="{ 'layer-tab-active': active === id }" :style="{ borderColor: value.color }" @click="active = id as LayerId">
        <span class="tab-dot" :style="{ background: value.color }"></span>{{ value.name }}
      </button>
    </div>
    <div class="layer-depth">{{ meta.name }} · 深度范围：{{ meta.depth }}</div>
    <div v-for="fact in meta.facts" :key="fact" class="fact">· {{ fact }}</div>
    <div class="section-title">两个不连续面与地震波</div>
    <div v-for="note in boundaryNotes" :key="note" class="fact">{{ note }}</div>
  </div>
</template>

<style scoped>
.layers-panel {
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

.earth-svg {
  width: 100%;
  height: auto;
}

.layer-tabs {
  display: flex;
  gap: 6px;
}

.layer-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1.5px solid rgba(5, 5, 5, 0.1);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.02);
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  cursor: pointer;
}

.layer-tab-active {
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.15);
}

.tab-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.layer-depth {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.fact {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 19px;
}

.section-title {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}
</style>
