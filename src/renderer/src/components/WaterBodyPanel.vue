<script setup lang="ts">
import { computed, ref } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import LineChart, { type ChartSeries } from '@renderer/components/charts/LineChart.vue'

const emit = defineEmits<{ close: [] }>()

type RechargeType = 'rain' | 'glacier' | 'groundwater' | 'lake'

const recharge = ref<RechargeType>('rain')

const rechargeOptions = [
  { value: 'rain', label: '大气降水' },
  { value: 'glacier', label: '冰川融水' },
  { value: 'groundwater', label: '地下水' },
  { value: 'lake', label: '湖泊水' }
] as const

const monthlyDischarge: Record<RechargeType, Array<[number, number]>> = {
  rain: [[1, 2.2], [2, 2.8], [3, 3.6], [4, 5.2], [5, 7.5], [6, 9.5], [7, 11.8], [8, 10.2], [9, 6.4], [10, 4.2], [11, 2.9], [12, 2.3]],
  glacier: [[1, 0.4], [2, 0.4], [3, 0.5], [4, 0.8], [5, 1.8], [6, 4.6], [7, 8.8], [8, 7.2], [9, 2.6], [10, 1.0], [11, 0.5], [12, 0.4]],
  groundwater: [[1, 4.8], [2, 4.7], [3, 4.6], [4, 4.6], [5, 4.8], [6, 5.0], [7, 5.3], [8, 5.2], [9, 5.0], [10, 4.9], [11, 4.8], [12, 4.8]],
  lake: [[1, 3.6], [2, 4.0], [3, 4.8], [4, 5.8], [5, 6.8], [6, 7.6], [7, 7.9], [8, 7.4], [9, 6.6], [10, 5.6], [11, 4.6], [12, 3.9]]
}

const series = computed<ChartSeries[]>(() => [
  { name: '河流径流量（月）', color: '#1677ff', points: monthlyDischarge[recharge.value] }
])

interface RechargeMeta {
  example: string
  features: string[]
}

const rechargeMeta: Record<RechargeType, RechargeMeta> = {
  rain: {
    example: '典型河流：闽江、珠江（我国东部季风区大多数河流）',
    features: ['径流变化与降水量一致：夏秋多雨出现夏汛，冬春枯水', '我国以夏汛为主；地中海气候区河流为冬汛', '流量过程线起伏与降水量过程线高度同步']
  },
  glacier: {
    example: '典型河流：塔里木河、天山山麓诸河（西北干旱区）',
    features: ['径流变化与气温一致：夏季气温高、冰川融水多，形成夏汛', '冬季断流或流量极小，年际变化取决于夏季气温', '“春旱夏汛”，是绿洲灌溉农业的重要水源']
  },
  groundwater: {
    example: '典型河流：大兴安岭以东、青藏高原部分河流',
    features: ['径流最稳定，流量过程线平缓，季节变化与年际变化都小', '地下水是河流枯水期的主要补给来源', '植被覆盖好、降水入渗多的地区地下水补给比重大']
  },
  lake: {
    example: '典型河流：松花江（上游长白山天池）、长江中游与湖泊群',
    features: ['湖泊对径流起调节作用：洪水期湖泊蓄水削减洪峰，枯水期补给河流', '流量过程线比降水补给平缓，汛期滞后', '大规模围湖造田会使调节能力下降、洪涝加剧']
  }
}

const meta = computed(() => rechargeMeta[recharge.value])

const relationships = '陆地水体相互关系：河流补给类型多样（大气降水、冰川融水、地下水、湖泊水），多数河流以某种类型为主、多种类型并存。河流水、湖泊水、地下水之间具有相互补给关系——水位高的水体补给水位低的水体，丰水期河流补给地下水与湖泊，枯水期则相反。'
</script>

<template>
  <div class="water-body-panel" role="group" aria-label="陆地水体与河流补给">
    <div class="panel-header">
      <span class="panel-title">陆地水体与河流补给</span>
      <a-button type="text" size="small" aria-label="关闭陆地水体与河流补给" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </div>
    <a-segmented v-model:value="recharge" size="small" :options="[...rechargeOptions]" aria-label="补给类型" />
    <div class="chart-title">{{ meta.example }}</div>
    <LineChart :series="series" :x-min="1" :x-max="12" x-name="月份" y-name="相对流量" :y-min="0" :y-max="12" :height="160" />
    <div v-for="feature in meta.features" :key="feature" class="fact">· {{ feature }}</div>
    <div class="panel-note">{{ relationships }}</div>
  </div>
</template>

<style scoped>
.water-body-panel {
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

.chart-title {
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

.panel-note {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 19px;
}
</style>
