<script setup lang="ts">
import { computed } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import LineChart, { type ChartSeries } from '@renderer/components/charts/LineChart.vue'

const emit = defineEmits<{ close: [] }>()

const TEMP_COLOR = '#1677ff'

const profilePoints: Array<[number, number]> = []
for (let h = 0; h <= 12; h += 1) profilePoints.push([15 - (h * 70) / 12, h])
for (let h = 13; h <= 50; h += 1) profilePoints.push([-55 + ((h - 12) * 52) / 38, h])
for (let h = 51; h <= 85; h += 1) profilePoints.push([-3 - ((h - 50) * 87) / 35, h])

const series = computed<ChartSeries[]>(() => [
  { name: '大气垂直温度廓线', color: TEMP_COLOR, points: profilePoints, markY: [12, 50, 85] }
])

const layers = [
  {
    name: '对流层（0~12 千米）',
    facts: ['气温随高度升高而降低，每上升 100 米约降 0.6℃', '集中了大气质量的 3/4 与几乎全部水汽、杂质', '对流运动显著，天气现象复杂多变，与人类关系最密切']
  },
  {
    name: '平流层（12~50 千米）',
    facts: ['臭氧大量吸收紫外线，气温随高度升高而升高', '上热下冷，大气以平流运动为主', '水汽杂质少、天气晴朗能见度好，适合高空飞行']
  },
  {
    name: '高层大气（50 千米以上）',
    facts: ['空气密度极小，气压很低', '80~500 千米存在若干电离层，能反射无线电短波', '对无线电通信具有重要作用']
  }
]
</script>

<template>
  <div class="layers-panel" role="group" aria-label="大气垂直分层">
    <div class="panel-header">
      <span class="panel-title">大气垂直分层</span>
      <a-button type="text" size="small" aria-label="关闭大气垂直分层" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </div>
    <div class="chart-title">气温随高度的分布（横轴：气温，纵轴：高度）</div>
    <LineChart
      :series="series"
      :x-min="-100"
      :x-max="20"
      x-name="气温(℃)"
      y-name="高度(千米)"
      :y-min="0"
      :y-max="100"
      :height="210"
    />
    <div v-for="layer in layers" :key="layer.name" class="layer-item">
      <div class="layer-name">{{ layer.name }}</div>
      <div v-for="fact in layer.facts" :key="fact" class="layer-fact">· {{ fact }}</div>
    </div>
    <div class="panel-note">曲线折点即分层界线：对流层顶约 12 千米、平流层顶约 50 千米、中间层顶约 85 千米；气温在界线处变化趋势反转。</div>
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
  width: 360px;
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

.chart-title {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.layer-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 4px;
}

.layer-name {
  color: rgba(0, 0, 0, 0.88);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.layer-fact {
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
  line-height: 19px;
}

.panel-note {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
}
</style>
