import { ref } from 'vue'
import { defineStore } from 'pinia'
import { MAJOR_VOLCANOES, NOTABLE_EARTHQUAKES } from '@renderer/utils/tectonicData'

export type FlyCapability = (lon: number, lat: number, height: number) => void

export const useTectonicStore = defineStore('tectonic', () => {
  const panelOpen = ref(false)
  const showBoundaries = ref(true)
  const showVolcanoes = ref(true)
  const showQuakes = ref(false)

  let flyTo: FlyCapability | null = null

  function registerFly(value: FlyCapability): void {
    flyTo = value
  }

  function locate(kind: 'volcano' | 'quake', name: string): void {
    if (!flyTo) return
    const source = kind === 'volcano' ? MAJOR_VOLCANOES.find((item) => item.name === name) : NOTABLE_EARTHQUAKES.find((item) => item.name === name)
    if (!source) return
    flyTo(source.lon, source.lat, 900000)
  }

  function setPanelOpen(value: boolean): void {
    panelOpen.value = value
  }

  function toggleShow(key: 'boundaries' | 'volcanoes' | 'quakes', value: boolean): void {
    if (key === 'boundaries') showBoundaries.value = value
    else if (key === 'volcanoes') showVolcanoes.value = value
    else showQuakes.value = value
  }

  return { panelOpen, showBoundaries, showVolcanoes, showQuakes, setPanelOpen, toggleShow, registerFly, locate }
})
