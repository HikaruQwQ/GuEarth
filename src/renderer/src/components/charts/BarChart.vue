<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'

use([BarChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer])

export interface BarSeries {
  name: string
  color: string
  values: number[]
}

interface TooltipParam {
  marker: string
  seriesName: string
  value: number
  name: string
}

const MONO_FONT = 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace'
const INK_TERTIARY = 'rgba(0, 0, 0, 0.45)'
const HAIRLINE = 'rgba(5, 5, 5, 0.06)'

const props = withDefaults(
  defineProps<{
    categories: string[]
    series: BarSeries[]
    orientation?: 'vertical' | 'horizontal'
    stacked?: boolean
    showLegend?: boolean
    absValues?: boolean
    valueMin?: number
    valueMax?: number
    xName?: string
    yName?: string
    height?: number
  }>(),
  { orientation: 'vertical', stacked: false, showLegend: false, absValues: false, height: 180 }
)

function formatNumber(value: number): string {
  const magnitude = Math.abs(value)
  const text = Number.isInteger(magnitude) ? String(magnitude) : (Math.round(magnitude * 10) / 10).toString()
  return value < 0 ? `-${text}` : text
}

const option = computed(() => {
  const horizontal = props.orientation === 'horizontal'
  const valueAxis = {
    type: 'value',
    min: props.valueMin,
    max: props.valueMax,
    name: horizontal ? props.xName : props.yName,
    nameTextStyle: { color: INK_TERTIARY, fontSize: 11, align: 'left' },
    axisLabel: {
      color: INK_TERTIARY,
      fontFamily: MONO_FONT,
      fontSize: 11,
      formatter: (value: number) => (props.absValues ? formatNumber(Math.abs(value)) : formatNumber(value))
    },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: HAIRLINE } }
  }
  const categoryAxis = {
    type: 'category',
    data: props.categories,
    axisLabel: { color: INK_TERTIARY, fontFamily: MONO_FONT, fontSize: 11, hideOverlap: true },
    axisLine: { show: true, lineStyle: { color: INK_TERTIARY } },
    axisTick: { show: false },
    splitLine: { show: false }
  }
  return {
    animation: false,
    grid: { left: 48, right: 20, top: 30, bottom: 30 },
    legend: props.showLegend
      ? {
          top: 0,
          left: 'center',
          itemWidth: 10,
          itemHeight: 10,
          itemGap: 12,
          textStyle: { color: 'rgba(0, 0, 0, 0.65)', fontSize: 11 }
        }
      : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      borderWidth: 0,
      padding: [4, 8],
      textStyle: { color: '#ffffff', fontSize: 12, lineHeight: 20 },
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? (params as TooltipParam[]) : [params as TooltipParam]
        if (!list.length) return ''
        const rows = list
          .filter((item) => item && item.seriesName)
          .map((item) => `${item.marker}${item.seriesName} ${props.absValues ? formatNumber(Math.abs(item.value)) : formatNumber(item.value)}`)
          .join('<br/>')
        return `${list[0].name}<br/>${rows}`
      }
    },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? { ...categoryAxis } : { ...valueAxis },
    series: props.series.map((item) => ({
      type: 'bar',
      name: item.name,
      data: item.values,
      stack: props.stacked ? 'total' : undefined,
      barMaxWidth: 22,
      itemStyle: { color: item.color },
      emphasis: { disabled: true }
    }))
  }
})
</script>

<template>
  <VChart class="bar-chart" :option="option" :style="{ height: `${height}px` }" autoresize />
</template>

<style scoped>
.bar-chart {
  width: 100%;
}
</style>
