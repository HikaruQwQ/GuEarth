import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useTerrainLabStore } from './terrainLab'
import { useMonsoonStore } from './monsoon'
import { useSolarStore } from './solar'
import { useTectonicStore } from './tectonic'
import { useWeatherStore } from './weather'

export type LabTab = 'terrain' | 'monsoon' | 'solar' | 'tectonic' | 'weather'

export const useLabStore = defineStore('lab', () => {
  const panelOpen = ref(false)
  const activeTab = ref<LabTab>('terrain')

  function syncModulePanels(): void {
    const open = panelOpen.value
    const tab = activeTab.value
    useTerrainLabStore().setPanelOpen(open && tab === 'terrain')
    useMonsoonStore().setPanelOpen(open && tab === 'monsoon')
    useSolarStore().setPanelOpen(open && tab === 'solar')
    useTectonicStore().setPanelOpen(open && tab === 'tectonic')
    useWeatherStore().setPanelOpen(open && tab === 'weather')
  }

  function setPanelOpen(value: boolean): void {
    panelOpen.value = value
    syncModulePanels()
  }

  function openTab(tab: LabTab): void {
    panelOpen.value = true
    activeTab.value = tab
    syncModulePanels()
  }

  function setActiveTab(tab: LabTab): void {
    activeTab.value = tab
    syncModulePanels()
  }

  return { panelOpen, activeTab, setPanelOpen, openTab, setActiveTab }
})
