<script setup lang="ts">
import { computed, ref } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { useClimateStore } from '@renderer/stores/climate'
import {
  censusAgeStructure, huComparison, huLineFacts, migrationFacts, pyramid2020, pyramidAgeGroups, pyramidFacts,
  urbanizationFacts, urbanizationSeries, POPULATION_CENSUS_YEAR
} from '@renderer/thematic/populationCensus'
import LineChart from '@renderer/components/charts/LineChart.vue'
import BarChart, { type BarSeries } from '@renderer/components/charts/BarChart.vue'

const emit = defineEmits<{ close: [] }>()

const climateStore = useClimateStore()

type Tab = 'pyramid' | 'urbanization' | 'hu-line'
const tab = ref<Tab>('pyramid')

const tabOptions = [
  { value: 'pyramid', label: '金字塔' },
  { value: 'urbanization', label: '城镇化' },
  { value: 'hu-line', label: '胡焕庸线' }
] as const

const pyramidValueBound = computed(() => {
  const max = Math.max(...pyramid2020.male.map(Math.abs), ...pyramid2020.female)
  return Math.ceil(max / 50) * 50
})

const pyramidSeries = computed<BarSeries[]>(() => [
  { name: '男', color: '#1677ff', values: pyramid2020.male.map((value) => -value) },
  { name: '女', color: '#f759ab', values: [...pyramid2020.female] }
])

const structureCategories = computed(() => censusAgeStructure.map((item) => String(item.year)))
const structureSeries = computed<BarSeries[]>(() => [
  { name: '0-14岁', color: '#1677ff', values: censusAgeStructure.map((item) => item.youngPct) },
  { name: '15-64岁', color: '#52c41a', values: censusAgeStructure.map((item) => item.workingPct) },
  { name: '65岁及以上', color: '#fa541c', values: censusAgeStructure.map((item) => item.elderlyPct) }
])

const urbanizationPoints = urbanizationSeries

const huCategories = ['面积占比', '人口占比']
const huSeries = computed<BarSeries[]>(() => [
  { name: '胡线以东', color: '#1677ff', values: [huComparison.eastAreaPct, huComparison.eastPopPct] },
  { name: '胡线以西', color: '#fa8c16', values: [huComparison.westAreaPct, huComparison.westPopPct] }
])
</script>

<template>
  <div class="population-panel" role="group" aria-label="人口">
    <div class="panel-header">
      <span class="panel-title">人口</span>
      <a-segmented v-model:value="tab" size="small" :options="[...tabOptions]" aria-label="人口面板标签" />
      <a-button type="text" size="small" aria-label="关闭人口面板" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </div>

    <template v-if="tab === 'pyramid'">
      <div class="chart-title">人口年龄结构（{{ POPULATION_CENSUS_YEAR }} · 万人）</div>
      <BarChart
        :categories="[...pyramidAgeGroups]"
        :series="pyramidSeries"
        orientation="horizontal"
        show-legend
        abs-values
        :value-min="-pyramidValueBound"
        :value-max="pyramidValueBound"
        x-name="万人"
        :height="252"
      />
      <div class="chart-title">历次普查年龄结构（%）</div>
      <BarChart
        :categories="structureCategories"
        :series="structureSeries"
        stacked
        show-legend
        :value-min="0"
        :value-max="100"
        y-name="%"
        :height="150"
      />
      <div v-for="fact in pyramidFacts" :key="fact" class="fact">· {{ fact }}</div>
      <div class="panel-note">数据：国家统计局第七次全国人口普查公报与《中国统计年鉴 2021》表 2-17；年龄结构为历次普查公布数。</div>
    </template>

    <template v-else-if="tab === 'urbanization'">
      <div class="chart-title">中国常住人口城镇化率（%）</div>
      <LineChart
        :series="[{ name: '城镇化率', color: '#1677ff', points: urbanizationPoints, markY: [30, 70] }]"
        :x-min="1949"
        :x-max="2023"
        :y-min="0"
        :y-max="80"
        x-name="年份"
        y-name="%"
        :height="180"
      />
      <div v-for="fact in urbanizationFacts" :key="fact" class="fact">· {{ fact }}</div>
      <a-button
        class="panel-action"
        size="small"
        block
        :disabled="climateStore.overlays['province-population']"
        @click="climateStore.setOverlay('province-population', true)"
      >
        {{ climateStore.overlays['province-population'] ? '省级人口密度图层已开启' : '在地球上查看省级人口密度' }}
      </a-button>
      <div class="panel-note">城镇人口比重 1949-2020 年取自《中国统计年鉴 2021》表 2-1，2023 年取自国家统计局公报。</div>
    </template>

    <template v-else>
      <div class="chart-title">胡焕庸线两侧对比（%）</div>
      <BarChart
        :categories="huCategories"
        :series="huSeries"
        show-legend
        :value-min="0"
        :value-max="100"
        y-name="%"
        :height="160"
      />
      <div v-for="fact in huLineFacts" :key="fact" class="fact">· {{ fact }}</div>
      <a-button
        class="panel-action"
        size="small"
        block
        :disabled="climateStore.overlays['hu-line']"
        @click="climateStore.setOverlay('hu-line', true)"
      >
        {{ climateStore.overlays['hu-line'] ? '胡焕庸线图层已开启' : '在地球上查看胡焕庸线' }}
      </a-button>
      <div class="panel-note">两侧对比为常用教科书概算数字；切换到「胡焕庸线」图层可在地球上查看东西两侧标注。</div>
      <div class="chart-title">省际迁移主线</div>
      <div v-for="fact in migrationFacts" :key="fact" class="fact">· {{ fact }}</div>
    </template>
  </div>
</template>

<style scoped>
.population-panel {
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

.population-panel > * {
  flex: none;
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

.panel-action {
  margin-top: 2px;
}
</style>
