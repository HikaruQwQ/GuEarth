import { ref } from 'vue'
import { defineStore } from 'pinia'

export type HydrologyPanel = 'water-cycle' | 'ocean-property' | 'tide' | 'water-bodies'

export const useHydrologyStore = defineStore('hydrology', () => {
  const panel = ref<HydrologyPanel | null>(null)

  function setPanel(value: HydrologyPanel | null): void {
    panel.value = value
  }

  return { panel, setPanel }
})
