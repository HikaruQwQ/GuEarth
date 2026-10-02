<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CloseOutlined, DeleteOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { providerCatalog, credentialOnlyProviders, terrainCatalog, type LayerMeta, type ProviderRegion, type SelectionMode } from '@renderer/stores/globe'

interface CredentialStatus {
  configured: boolean
  updatedAt: number | null
}

const props = defineProps<{
  open: boolean
  layers: LayerMeta[]
  selectedLayerId: string
  error: string
  terrainError: string
  loading: boolean
  selectionMode: SelectionMode
  chinaProviderId: string
  globalProviderId: string
  providerStyles: Record<string, string>
  terrainProviderId: string
  terrainExaggeration: number
  terrainLighting: boolean
  tileCacheEnabled: boolean
  providerCredentials: Record<string, CredentialStatus>
}>()

const emit = defineEmits<{
  close: []
  select: [id: string]
  opacity: [id: string, opacity: number]
  retry: []
  mode: [value: SelectionMode]
  regionProvider: [region: ProviderRegion, id: string]
  providerStyle: [providerId: string, styleId: string]
  terrain: [id: string]
  terrainExaggeration: [value: number]
  terrainLighting: [value: boolean]
  cache: [value: boolean]
  credentialSave: [id: string, apiKey: string, securityKey?: string]
  credentialClear: [id: string]
}>()

const basemaps = computed(() => props.layers.filter((layer) => layer.kind === 'basemap'))
const chinaProviders = computed(() => providerCatalog.filter((provider) => provider.region === 'china'))
const globalProviders = computed(() => providerCatalog.filter((provider) => provider.region === 'global'))
const keyProviders = computed(() => [...providerCatalog, ...credentialOnlyProviders].filter((provider) => provider.requiresKey))
const credentialProviderId = ref('')
const credentialDraft = ref('')
const credentialSkDraft = ref('')

const selectedCredentialStatus = computed(() => props.providerCredentials[credentialProviderId.value])
const selectedSecurityCredentialStatus = computed(() => props.providerCredentials[`${credentialProviderId.value}-sk`])
const selectedProvider = computed(() => [...providerCatalog, ...credentialOnlyProviders].find((provider) => provider.id === credentialProviderId.value))
const supportsSecurityKey = computed(() => Boolean(selectedProvider.value?.requiresSk || selectedProvider.value?.requiresSecurityKey))
const requiresSecurityKey = computed(() => Boolean((selectedProvider.value?.requiresSecurityKey && !selectedProvider.value?.securityKeyOptional) || (selectedProvider.value?.requiresSk && !selectedProvider.value?.skOptional)))
const securityKeyPlaceholder = computed(() => selectedProvider.value?.requiresSecurityKey ? '输入安全密钥 (securityJsCode)' : '输入 SK (签名密钥，可选)')

function stylesFor(providerId: string) {
  return providerCatalog.find((provider) => provider.id === providerId)?.styles ?? []
}

watch(keyProviders, (providers) => {
  if (!providers.some((provider) => provider.id === credentialProviderId.value)) credentialProviderId.value = providers[0]?.id ?? ''
}, { immediate: true })

watch(credentialProviderId, () => {
  credentialDraft.value = ''
  credentialSkDraft.value = ''
})

function handleModeChange(event: { target: { value: SelectionMode } }): void {
  emit('mode', event.target.value)
}

function saveCredential(): void {
  const value = credentialDraft.value.trim()
  const sk = credentialSkDraft.value.trim()
  if (!credentialProviderId.value || !value || (requiresSecurityKey.value && !sk)) return
  emit('credentialSave', credentialProviderId.value, value, sk || undefined)
  credentialDraft.value = ''
  credentialSkDraft.value = ''
}

function clearCredential(): void {
  if (!credentialProviderId.value) return
  emit('credentialClear', credentialProviderId.value)
  credentialDraft.value = ''
  credentialSkDraft.value = ''
}
</script>

<template>
  <a-drawer :open="open" placement="right" :width="360" :mask="false" :closable="false" :body-style="{ padding: '16px' }" @close="emit('close')">
    <template #title>
      <div class="panel-title">
        <div><div class="panel-kicker">LAYERS</div><h2>图层管理</h2></div>
        <a-button type="text" aria-label="关闭图层管理" @click="emit('close')"><CloseOutlined /></a-button>
      </div>
    </template>
    <a-alert v-if="error" type="error" show-icon :message="error" class="panel-alert">
      <template #action><a-button type="text" size="small" @click="emit('retry')"><ReloadOutlined />重试</a-button></template>
    </a-alert>
    <a-spin :spinning="loading" class="layer-spin">
      <section class="panel-section">
        <div class="section-heading"><span>模式</span></div>
        <a-radio-group :value="selectionMode" button-style="solid" @change="handleModeChange">
          <a-radio-button value="manual">手动</a-radio-button>
          <a-radio-button value="auto">按区域</a-radio-button>
        </a-radio-group>
      </section>

      <section class="panel-section">
        <div class="section-heading"><span>区域供应商</span></div>
        <div class="provider-row"><span>大陆内</span><div class="provider-controls"><a-select :value="chinaProviderId" class="provider-select" @change="(value: string) => emit('regionProvider', 'china', value)"><a-select-option v-for="provider in chinaProviders" :key="provider.id" :value="provider.id">{{ provider.name }}</a-select-option></a-select><a-select :value="providerStyles[chinaProviderId]" class="style-select" @change="(value: string) => emit('providerStyle', chinaProviderId, value)"><a-select-option v-for="style in stylesFor(chinaProviderId)" :key="style.id" :value="style.id">{{ style.name }}</a-select-option></a-select></div></div>
        <div class="provider-row"><span>大陆外</span><div class="provider-controls"><a-select :value="globalProviderId" class="provider-select" @change="(value: string) => emit('regionProvider', 'global', value)"><a-select-option v-for="provider in globalProviders" :key="provider.id" :value="provider.id">{{ provider.name }}</a-select-option></a-select><a-select :value="providerStyles[globalProviderId]" class="style-select" @change="(value: string) => emit('providerStyle', globalProviderId, value)"><a-select-option v-for="style in stylesFor(globalProviderId)" :key="style.id" :value="style.id">{{ style.name }}</a-select-option></a-select></div></div>
      </section>

      <section class="panel-section">
        <div class="section-heading"><span>地形</span></div>
        <a-select :value="terrainProviderId" class="full-select" @change="(value: string) => emit('terrain', value)">
          <a-select-option v-for="option in terrainCatalog" :key="option.id" :value="option.id" :title="option.description">{{ option.name }}</a-select-option>
        </a-select>
        <div class="terrain-slider-head"><span>垂直夸张</span><span>{{ terrainExaggeration }}×</span></div>
        <a-slider
          :value="terrainExaggeration"
          :min="1"
          :max="5"
          :step="0.5"
          :marks="{ 1: '1×', 3: '3×', 5: '5×' }"
          aria-label="地形垂直夸张倍数"
          @change="(value: number) => emit('terrainExaggeration', value)"
        />
        <div class="terrain-lighting-row"><span>太阳光照</span><a-switch size="small" :checked="terrainLighting" @change="(value: boolean) => emit('terrainLighting', value)" /></div>
        <a-alert v-if="terrainError" type="warning" :message="terrainError" show-icon class="terrain-alert" />
      </section>

      <section class="panel-section cache-row">
        <span>瓦片缓存</span><a-switch :checked="tileCacheEnabled" @change="(value: boolean) => emit('cache', value)" />
      </section>

      <section v-if="keyProviders.length" class="panel-section">
        <div class="section-heading"><span>供应商密钥</span><a-tag v-if="selectedCredentialStatus?.configured && (!requiresSecurityKey || selectedSecurityCredentialStatus?.configured)" color="green">已配置</a-tag></div>
        <a-select v-model:value="credentialProviderId" class="full-select"><a-select-option v-for="provider in keyProviders" :key="provider.id" :value="provider.id">{{ provider.name }}</a-select-option></a-select>
        <a-input v-model:value="credentialDraft" type="password" size="small" :placeholder="supportsSecurityKey ? '输入 AK (访问密钥)' : '输入 API Key'" class="key-input" @press-enter="saveCredential" />
        <a-input v-if="supportsSecurityKey" v-model:value="credentialSkDraft" type="password" size="small" :placeholder="securityKeyPlaceholder" class="key-input" @press-enter="saveCredential" />
        <a-alert v-if="supportsSecurityKey && !requiresSecurityKey" type="info" message="若使用签名鉴权，需填写有效签名密钥" show-icon class="credential-hint" />
        <div class="key-actions">
          <a-button type="primary" size="small" :disabled="!credentialDraft.trim() || (requiresSecurityKey && !credentialSkDraft.trim())" @click="saveCredential"><SaveOutlined />保存</a-button>
          <a-button size="small" :disabled="!selectedCredentialStatus?.configured && !selectedSecurityCredentialStatus?.configured" @click="clearCredential"><DeleteOutlined />清除</a-button>
        </div>
      </section>

      <section class="panel-section">
        <div class="section-heading"><span>底图</span><a-tag color="blue">{{ basemaps.length }}</a-tag></div>
        <a-empty v-if="!basemaps.length && !loading" description="暂无可用图层" />
        <a-list v-else :data-source="basemaps" :split="false" class="layer-list">
          <template #renderItem="{ item }">
            <a-list-item :class="['layer-item', { selected: item.id === selectedLayerId }]">
              <div class="layer-main" @click="emit('select', item.id)">
                <a-radio :checked="item.id === selectedLayerId" :aria-label="`选择${item.name}底图`" />
                <div class="layer-copy"><div class="layer-name">{{ item.name }}</div><div class="layer-description">{{ item.description }}</div></div>
              </div>
              <div class="layer-control"><span>不透明度</span><span>{{ Math.round(item.opacity * 100) }}%</span></div>
              <a-select :value="providerStyles[item.providerId]" size="small" class="style-select" @change="(value: string) => emit('providerStyle', item.providerId, value)">
                <a-select-option v-for="style in stylesFor(item.providerId)" :key="style.id" :value="style.id">{{ style.name }}</a-select-option>
              </a-select>
              <a-slider :value="item.opacity * 100" :min="0" :max="100" :step="5" :aria-label="`${item.name}不透明度`" @change="(value: number) => emit('opacity', item.id, value / 100)" />
            </a-list-item>
          </template>
        </a-list>
      </section>
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.panel-title{display:flex;align-items:center;justify-content:space-between;width:100%}.panel-kicker{color:rgba(0,0,0,.45);font-size:12px;line-height:20px;letter-spacing:.08em}h2{margin:0;color:rgba(0,0,0,.88);font-size:20px;font-weight:600;line-height:28px}.panel-alert{margin-bottom:16px}.layer-spin{display:block;min-height:168px}.panel-section{padding:0 0 16px;margin:0 0 16px;border-bottom:1px solid rgba(5,5,5,.06)}.section-heading{display:flex;align-items:center;justify-content:space-between;margin:0 0 8px;color:rgba(0,0,0,.65);font-size:12px;line-height:20px}.provider-row{display:flex;align-items:flex-start;gap:12px;margin:8px 0;color:rgba(0,0,0,.65);font-size:13px}.provider-row>span{width:52px;flex:none;padding-top:6px}.provider-controls{display:flex;min-width:0;flex:1;gap:8px}.provider-select,.provider-controls .style-select{min-width:0;flex:1;margin:0}.full-select{width:100%}.cache-row{display:flex;align-items:center;justify-content:space-between}.terrain-slider-head{display:flex;align-items:center;justify-content:space-between;margin-top:12px;color:rgba(0,0,0,.65);font-size:13px;line-height:20px}.terrain-lighting-row{display:flex;align-items:center;justify-content:space-between;margin-top:4px;color:rgba(0,0,0,.65);font-size:13px;line-height:20px}.terrain-alert{margin-top:8px}.key-input{margin-top:8px}.credential-hint{margin-top:8px}.key-actions{display:flex;gap:8px;margin-top:8px}.layer-list :deep(.ant-list-item){display:block;padding:12px 8px;border-radius:6px}.layer-item.selected{background:rgba(22,119,255,.06)}.layer-main{display:flex;align-items:center;min-height:32px;cursor:pointer}.layer-copy{min-width:0;flex:1}.layer-name{overflow:hidden;color:rgba(0,0,0,.88);font-size:14px;line-height:22px;text-overflow:ellipsis;white-space:nowrap}.layer-description{color:rgba(0,0,0,.45);font-size:12px;line-height:20px}.layer-control{display:flex;justify-content:space-between;margin:8px 0 0 32px;color:rgba(0,0,0,.45);font-size:12px;line-height:20px}.style-select{width:calc(100% - 32px);margin:8px 0 0 32px}.layer-item :deep(.ant-slider){margin:8px 8px 0 32px}
</style>
