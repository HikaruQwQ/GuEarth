import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface FocusedFeature {
  name: string
  layerName: string
  summary: string
}

export const useFeatureFocusStore = defineStore('featureFocus', () => {
  const focused = ref<FocusedFeature | null>(null)

  function setFocus(feature: FocusedFeature): void {
    focused.value = feature
  }

  function clearFocus(): void {
    focused.value = null
  }

  return { focused, setFocus, clearFocus }
})
