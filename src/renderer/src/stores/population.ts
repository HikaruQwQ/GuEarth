import { ref } from 'vue'
import { defineStore } from 'pinia'

export const usePopulationStore = defineStore('population', () => {
  const panel = ref<'population' | null>(null)
  function setPanel(value: 'population' | null): void {
    panel.value = value
  }
  return { panel, setPanel }
})
