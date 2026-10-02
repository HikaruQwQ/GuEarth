<script setup lang="ts">
import { h, onBeforeUnmount, ref, watch } from 'vue'
import { LoadingOutlined, SearchOutlined } from '@ant-design/icons-vue'
import type { PlaceSuggestion } from '../../../preload'

interface PlaceOption {
  value: string
  key: string
  disabled?: boolean
  place?: PlaceSuggestion
  label: ReturnType<typeof h>
}

const emit = defineEmits<{
  select: [place: PlaceSuggestion]
}>()

const keyword = ref('')
const options = ref<PlaceOption[]>([])
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let requestSeq = 0
let suppressWatch = false

function regionText(place: PlaceSuggestion): string {
  const region = [place.province, place.city, place.district].filter((part) => part && part !== place.name).join(' · ')
  return [region, place.address].filter((part) => part).join(' · ')
}

function statusOption(text: string, isError: boolean): PlaceOption {
  return {
    value: `status:${text}`,
    key: `status:${text}`,
    disabled: true,
    label: h('div', { class: isError ? 'guearth-place-status guearth-place-status-error' : 'guearth-place-status' }, text)
  }
}

function placeOption(place: PlaceSuggestion, index: number): PlaceOption {
  return {
    value: `${place.name}:${place.longitude},${place.latitude}:${index}`,
    key: `${place.name}:${place.longitude},${place.latitude}:${index}`,
    place,
    label: h('div', { class: 'guearth-place-option' }, [
      h('div', { class: 'guearth-place-option-name' }, place.name),
      h('div', { class: 'guearth-place-option-meta' }, regionText(place) || place.type)
    ])
  }
}

async function search(text: string): Promise<void> {
  const seq = ++requestSeq
  if (!window.guEarth?.places) {
    options.value = [statusOption('搜索服务不可用', true)]
    return
  }
  options.value = [{
    value: 'status:loading',
    key: 'status:loading',
    disabled: true,
    label: h('div', { class: 'guearth-place-status' }, [h(LoadingOutlined, { spin: true, style: 'margin-right:6px' }), '正在搜索…'])
  }]
  let result
  try {
    result = await window.guEarth.places.search(text)
  } catch {
    if (seq === requestSeq) options.value = [statusOption('搜索失败，请稍后重试', true)]
    return
  }
  if (seq !== requestSeq) return
  if (result.error) options.value = [statusOption(result.error, true)]
  else if (!result.places.length) options.value = [statusOption(result.note ?? '没有找到匹配的地点', false)]
  else options.value = result.places.map((place, index) => placeOption(place, index))
}

watch(keyword, (text) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (suppressWatch) {
    suppressWatch = false
    return
  }
  requestSeq += 1
  options.value = []
  const query = text.trim()
  if (!query) {
    return
  }
  debounceTimer = setTimeout(() => {
    void search(query)
  }, 300)
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  requestSeq += 1
})

function handleSelect(value: string, option: PlaceOption): void {
  if (!option.place) return
  suppressWatch = true
  keyword.value = option.place.name
  options.value = []
  emit('select', option.place)
}
</script>

<template>
  <div class="place-search">
    <a-auto-complete
      v-model:value="keyword"
      :options="options"
      :filter-option="false"
      popup-class-name="guearth-place-dropdown"
      @select="handleSelect"
    >
      <a-input allow-clear placeholder="搜索地点，如：珠穆朗玛峰" aria-label="搜索地点">
        <template #prefix><SearchOutlined class="place-search-icon" /></template>
      </a-input>
    </a-auto-complete>
  </div>
</template>

<style scoped>
.place-search {
  position: absolute;
  top: 24px;
  left: 72px;
  width: 300px;
  z-index: 10;
}

.place-search :deep(.ant-input-affix-wrapper) {
  border-radius: 6px;
}

.place-search-icon {
  color: rgba(0, 0, 0, 45%);
}
</style>

<style>
.guearth-place-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
}

.guearth-place-option-name {
  color: rgba(0, 0, 0, 0.88);
  font-size: 14px;
  line-height: 22px;
}

.guearth-place-option-meta {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.guearth-place-status {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 20px;
}

.guearth-place-status-error {
  color: #ff4d4f;
}

.guearth-place-dropdown .ant-select-item-option-content {
  white-space: normal;
}
</style>
