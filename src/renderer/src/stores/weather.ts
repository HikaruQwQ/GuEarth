import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { TYPHOON_EVENTS, categoryForWind } from '@renderer/utils/typhoonData'

export type FrontKind = 'cold' | 'warm' | 'stationary'
export type PressureSystemKind = 'low' | 'high'
export type HemisphereKind = 'north' | 'south'

export const useWeatherStore = defineStore('weather', () => {
  const panelOpen = ref(false)
  const front = ref<FrontKind>('cold')
  const systemKind = ref<PressureSystemKind>('low')
  const hemisphere = ref<HemisphereKind>('north')
  const typhoonId = ref(TYPHOON_EVENTS[0].id)
  const typhoonPlaying = ref(false)
  const typhoonProgress = ref(0)
  const typhoonSpeed = ref(0.12)

  const typhoon = computed(() => TYPHOON_EVENTS.find((event) => event.id === typhoonId.value) ?? TYPHOON_EVENTS[0])
  const typhoonIndex = computed(() => Math.round(typhoonProgress.value * (typhoon.value.points.length - 1)))
  const typhoonPoint = computed(() => typhoon.value.points[Math.min(typhoonIndex.value, typhoon.value.points.length - 1)])
  const typhoonReadout = computed(() => {
    const point = typhoonPoint.value
    return {
      date: `${typhoon.value.year}-${point.date}`,
      windMs: point.windMs,
      category: categoryForWind(point.windMs)
    }
  })

  let timer: ReturnType<typeof setInterval> | null = null

  function stopPlayback(): void {
    typhoonPlaying.value = false
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function togglePlay(): void {
    if (typhoonPlaying.value) {
      stopPlayback()
      return
    }
    if (typhoonProgress.value >= 1) typhoonProgress.value = 0
    typhoonPlaying.value = true
    timer = setInterval(() => {
      typhoonProgress.value = Math.min(1, typhoonProgress.value + typhoonSpeed.value / Math.max(1, typhoon.value.points.length - 1))
      if (typhoonProgress.value >= 1) stopPlayback()
    }, 160)
  }

  function setPanelOpen(value: boolean): void {
    panelOpen.value = value
    if (!value) stopPlayback()
  }

  function setTyphoon(id: string): void {
    typhoonId.value = id
    typhoonProgress.value = 0
    stopPlayback()
  }

  function setFront(kind: FrontKind): void {
    front.value = kind
  }

  function setSystemKind(kind: PressureSystemKind): void {
    systemKind.value = kind
  }

  function setHemisphere(kind: HemisphereKind): void {
    hemisphere.value = kind
  }

  watch(typhoonId, () => {
    typhoonProgress.value = 0
  })

  return {
    panelOpen, front, systemKind, hemisphere,
    typhoonId, typhoonPlaying, typhoonProgress, typhoon,
    typhoonPoint, typhoonReadout,
    setPanelOpen, setTyphoon, setFront, setSystemKind, setHemisphere, togglePlay
  }
})
