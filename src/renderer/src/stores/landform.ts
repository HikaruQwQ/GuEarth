import { ref } from 'vue'
import { defineStore } from 'pinia'

export type LandformPanel = 'fold-fault' | 'river' | 'landform-guide' | 'exogenic' | 'earth-layers'

export const useLandformStore = defineStore('landform', () => {
  const panel = ref<LandformPanel | null>(null)

  function setPanel(value: LandformPanel | null): void {
    panel.value = value
  }

  return { panel, setPanel }
})
