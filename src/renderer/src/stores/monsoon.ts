import { ref } from 'vue'
import { defineStore } from 'pinia'

function wrapMonth(value: number): number {
  const span = value - 1
  const wrapped = ((span % 12) + 12) % 12
  return wrapped + 1
}

export const useMonsoonStore = defineStore('monsoon', () => {
  const panelOpen = ref(false)
  const playing = ref(false)
  const monthPhase = ref(7)
  const month = ref(7)
  const showParticles = ref(true)
  const showRainband = ref(true)
  const showSummerWind = ref(false)
  const showWinterWind = ref(false)
  const showCurrents = ref(true)
  const showClimateZones = ref(false)
  const showMonsoonCurrents = ref(false)
  const showPressureBelts = ref(false)
  const showWindBelts = ref(false)

  function setPanelOpen(value: boolean): void {
    panelOpen.value = value
  }

  function setMonth(value: number): void {
    const clamped = Math.min(12, Math.max(1, Math.round(value)))
    monthPhase.value = clamped
    month.value = clamped
  }

  function advancePhase(deltaMonths: number): void {
    monthPhase.value = wrapMonth(monthPhase.value + deltaMonths)
    month.value = Math.min(12, Math.max(1, Math.round(monthPhase.value)))
  }

  function togglePlay(): void {
    playing.value = !playing.value
  }

  function setShow(key: 'particles' | 'rainband' | 'summerWind' | 'winterWind' | 'currents' | 'climateZones' | 'monsoonCurrents' | 'pressureBelts' | 'windBelts', value: boolean): void {
    if (key === 'particles') showParticles.value = value
    else if (key === 'rainband') showRainband.value = value
    else if (key === 'summerWind') showSummerWind.value = value
    else if (key === 'winterWind') showWinterWind.value = value
    else if (key === 'currents') showCurrents.value = value
    else if (key === 'monsoonCurrents') showMonsoonCurrents.value = value
    else if (key === 'pressureBelts') showPressureBelts.value = value
    else if (key === 'windBelts') showWindBelts.value = value
    else showClimateZones.value = value
  }

  return {
    panelOpen, playing, monthPhase, month,
    showParticles, showRainband, showSummerWind, showWinterWind, showCurrents, showClimateZones,
    showMonsoonCurrents, showPressureBelts, showWindBelts,
    setPanelOpen, setMonth, advancePhase, togglePlay, setShow
  }
})
