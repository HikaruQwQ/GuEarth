import { ref } from 'vue'
import { defineStore } from 'pinia'

export type AtmospherePanel = 'circulation' | 'heating' | 'layers'

export const useAtmosphereStore = defineStore('atmosphere', () => {
  const panel = ref<AtmospherePanel | null>(null)

  function setPanel(value: AtmospherePanel | null): void {
    panel.value = value
  }

  return { panel, setPanel }
})
