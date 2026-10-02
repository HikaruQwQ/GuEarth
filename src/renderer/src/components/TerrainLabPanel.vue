<script setup lang="ts">
import { computed } from 'vue'
import { AimOutlined, DeleteOutlined, DownloadOutlined, FileImageOutlined, LineOutlined, ReloadOutlined, TableOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { useTerrainLabStore } from '@renderer/stores/terrainLab'
import { formatElevation, formatKm } from '@renderer/utils/geo'
import { drawProfileChart } from '@renderer/utils/profileChart'
import { contoursToGeoJson, profileToCsv } from '@renderer/utils/vectorFiles'
import { blobToBase64 } from '@renderer/utils/capture'
import ProfileChart from '@renderer/components/ProfileChart.vue'

const store = useTerrainLabStore()

const intervalOptions = [
  { value: 0, label: '自动' },
  { value: 25, label: '25 m' },
  { value: 50, label: '50 m' },
  { value: 100, label: '100 m' },
  { value: 200, label: '200 m' },
  { value: 500, label: '500 m' }
]

const hasModel = computed(() => store.phase === 'sampling' || store.phase === 'ready' || store.phase === 'drawingProfile')
const boundsText = computed(() => {
  if (!store.bounds) return ''
  const { west, east, south, north } = store.bounds
  return `${west.toFixed(2)}°~${east.toFixed(2)}°E · ${south.toFixed(2)}°~${north.toFixed(2)}°N`
})
const hasProfile = computed(() => (store.profile?.length ?? 0) > 1)

async function saveText(defaultName: string, text: string, extension: string, mime: string): Promise<void> {
  try {
    const base64 = btoa(unescape(encodeURIComponent(text)))
    const saved = await window.guEarth.geoio.saveBinary(defaultName, base64, extension, mime)
    if (saved) message.success('导出成功')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '导出失败')
  }
}

async function handleExportProfilePng(): Promise<void> {
  const profile = store.profile
  if (!profile || profile.length < 2) return
  try {
    const width = 1200
    const height = 620
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('画布不可用')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(0,0,0,0.88)'
    ctx.font = "600 20px -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    ctx.fillText('地形剖面图', 32, 40)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.font = "400 13px -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    ctx.fillText(boundsText.value, 32, 64)
    ctx.translate(32, 88)
    drawProfileChart(ctx, profile, width - 64, height - 120)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('生成图片失败')
    const base64 = await blobToBase64(blob)
    const saved = await window.guEarth.geoio.saveBinary('地形剖面图', base64, 'png', 'image/png')
    if (saved) message.success('导出成功')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '导出失败')
  }
}

function handleExportProfileCsv(): void {
  const profile = store.profile
  if (!profile || profile.length < 2) return
  void saveText('地形剖面数据', profileToCsv(profile), 'csv', 'text/csv')
}

function handleExportContours(): void {
  const contours = store.getContours()
  if (contours.length === 0) {
    message.warning('没有可导出的等高线')
    return
  }
  void saveText('等高线', contoursToGeoJson(contours), 'geojson', 'application/geo+json')
}
</script>

<template>
  <div class="terrain-pane">
    <a-alert v-if="store.error" type="error" show-icon :message="store.error" class="panel-alert">
      <template #action><a-button type="text" size="small" @click="store.resample()"><ReloadOutlined />重试</a-button></template>
    </a-alert>

    <section v-if="store.phase === 'idle' || store.phase === 'selecting'" class="panel-section">
      <a-empty description="在地球上框选一块区域" />
      <p class="hint">点击下方按钮后，在地球上按住左键拖出一个矩形（最大 8°×8°），松开后自动采样高程并生成 3D 地形模型与等高线。</p>
      <a-button v-if="store.phase === 'idle'" type="primary" block @click="store.startSelection()"><AimOutlined />开始框选区域</a-button>
      <a-alert v-else type="info" message="框选模式：按住左键拖出矩形" show-icon class="hint-alert" />
    </section>

    <a-spin v-if="store.phase === 'sampling'" class="sampling-spin" tip="正在从高程服务采样地形数据…">
      <div class="sampling-holder" />
    </a-spin>

    <template v-if="hasModel">
      <section class="panel-section">
        <div class="section-heading"><span>区域</span></div>
        <div class="stat-row"><span>范围</span><span class="stat-value">{{ boundsText }}</span></div>
        <div class="stat-row"><span>面积</span><span class="stat-value">{{ formatKm(Math.sqrt(store.stats?.areaKm2 ?? 0)) }}² · {{ (store.stats?.areaKm2 ?? 0).toFixed(0) }} km²</span></div>
        <div class="stat-row"><span>高程</span><span class="stat-value">{{ formatElevation(store.stats?.minElevation ?? 0) }} ~ {{ formatElevation(store.stats?.maxElevation ?? 0) }}</span></div>
      </section>

      <section class="panel-section">
        <div class="section-heading"><span>模型</span></div>
        <div class="slider-row"><span>垂直夸大 ×{{ store.exaggeration.toFixed(1) }}</span><a-slider :value="store.exaggeration" :min="1" :max="5" :step="0.5" aria-label="垂直夸大系数" @change="(value: number) => (store.exaggeration = value)" /></div>
        <div class="slider-row"><span>等高距</span><a-select :value="store.contourInterval" size="small" class="interval-select" aria-label="等高距" @change="(value: number) => (store.contourInterval = value)">
          <a-select-option v-for="option in intervalOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
        </a-select></div>
        <div class="terrain-lighting-row"><span>坡度分析</span><a-switch size="small" :checked="store.slopeAnalysis" aria-label="坡度分析" @change="(value: boolean) => (store.slopeAnalysis = value === true)" /></div>
        <div v-if="store.slopeAnalysis" class="slope-legend">
          <span class="slope-item"><span class="slope-swatch" style="background:#52c41a"></span>&lt;10°</span>
          <span class="slope-item"><span class="slope-swatch" style="background:#a0d911"></span>10–20°</span>
          <span class="slope-item"><span class="slope-swatch" style="background:#fadb14"></span>20–30°</span>
          <span class="slope-item"><span class="slope-swatch" style="background:#fa8c16"></span>30–38°</span>
          <span class="slope-item"><span class="slope-swatch" style="background:#f5222d"></span>&gt;38°</span>
          <span class="slope-item"><span class="slope-dot"></span>山峰</span>
        </div>
      </section>

      <section class="panel-section">
        <div class="section-heading"><span>剖面分析</span></div>
        <template v-if="store.phase !== 'drawingProfile'">
          <a-button block @click="store.startProfile()"><LineOutlined />在模型上画剖面线</a-button>
        </template>
        <template v-else>
          <a-alert type="info" :message="`在模型上左键取点（已取 ${store.profilePoints.length} 个），右键结束`" show-icon class="hint-alert" />
          <div class="profile-actions">
            <a-button type="primary" size="small" :disabled="store.profilePoints.length < 2" @click="store.finishProfile()">生成剖面</a-button>
            <a-button size="small" @click="store.cancelProfile()">取消</a-button>
          </div>
        </template>
        <ProfileChart v-if="store.profile && store.profile.length > 1" :profile="store.profile" />
        <div v-if="store.profile && store.profile.length > 1" class="stat-row profile-summary">
          <span>剖面全长</span><span class="stat-value">{{ formatKm(store.profile[store.profile.length - 1].distanceKm) }}</span>
          <a-button type="text" size="small" aria-label="清除剖面" @click="store.clearProfile()"><DeleteOutlined /></a-button>
        </div>
      </section>

      <section class="panel-section">
        <div class="section-heading"><span>导出</span></div>
        <div class="export-actions">
          <a-button size="small" :disabled="!hasProfile" @click="handleExportProfilePng"><FileImageOutlined />剖面图 PNG</a-button>
          <a-button size="small" :disabled="!hasProfile" @click="handleExportProfileCsv"><TableOutlined />剖面数据 CSV</a-button>
          <a-button size="small" @click="handleExportContours"><DownloadOutlined />等高线 GeoJSON</a-button>
        </div>
      </section>

      <section class="panel-section model-actions">
        <a-button size="small" @click="store.startSelection()"><AimOutlined />重新框选</a-button>
        <a-button size="small" @click="store.resample()"><ReloadOutlined />重新采样</a-button>
        <a-button size="small" danger @click="store.removeModel()"><DeleteOutlined />移除模型</a-button>
      </section>
    </template>
  </div>
</template>

<style scoped>
.panel-alert{margin-bottom:16px}
.panel-section{padding:0 0 16px;margin:0 0 16px;border-bottom:1px solid rgba(5,5,5,.06)}
.hint{color:rgba(0,0,0,.65);font-size:12px;line-height:20px;margin:8px 0 12px}
.hint-alert{margin-bottom:8px}
.sampling-spin{display:block;margin:24px 0}
.sampling-holder{height:120px}
.stat-row{display:flex;align-items:center;gap:8px;margin:6px 0;font-size:13px;color:rgba(0,0,0,.65)}
.stat-value{font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:12px;color:rgba(0,0,0,.88);word-break:break-all}
.slider-row{display:flex;align-items:center;gap:12px;margin:8px 0;color:rgba(0,0,0,.65);font-size:13px}
.slider-row>span:first-child{flex:none;width:110px}
.slider-row :deep(.ant-slider){flex:1;margin:0}
.interval-select{width:90px}
.terrain-lighting-row{display:flex;align-items:center;justify-content:space-between;margin-top:6px;color:rgba(0,0,0,.65);font-size:13px;line-height:20px}
.slope-legend{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:8px}
.slope-item{display:flex;align-items:center;gap:4px;color:rgba(0,0,0,.65);font-size:12px;line-height:18px}
.slope-swatch{width:14px;height:4px;border-radius:2px}
.slope-dot{width:8px;height:8px;border-radius:50%;background:#f5222d}
.profile-actions{display:flex;gap:8px;margin-top:8px}
.export-actions{display:flex;flex-wrap:wrap;gap:8px}
.profile-summary{justify-content:space-between}
.model-actions{display:flex;gap:8px;border-bottom:none;margin-bottom:0}
</style>
