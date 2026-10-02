import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useTectonicStore = defineStore('tectonic', () => {
  const panelOpen = ref(false)
  const showBoundaries = ref(true)
  const showVolcanoes = ref(true)
  const showQuakes = ref(false)

  function setPanelOpen(value: boolean): void {
    panelOpen.value = value
  }

  function toggleShow(key: 'boundaries' | 'volcanoes' | 'quakes', value: boolean): void {
    if (key === 'boundaries') showBoundaries.value = value
    else if (key === 'volcanoes') showVolcanoes.value = value
    else showQuakes.value = value
  }

  return { panelOpen, showBoundaries, showVolcanoes, showQuakes, setPanelOpen, toggleShow }
})
