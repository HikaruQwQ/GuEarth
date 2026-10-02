import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { datePartsOf, formatClock, presetDate, shiftDate, type DateParts, type SolarPreset } from '@renderer/thematic/solarMath'

const BEIJING_OFFSET_HOURS = 8
const HOURS_PER_SECOND = 1.5

function beijingNow(): { date: string; hour: number } {
  const ms = Date.now() + BEIJING_OFFSET_HOURS * 3600000
  return { date: new Date(ms).toISOString().slice(0, 10), hour: (ms % 86400000) / 3600000 }
}

export const useSolarStore = defineStore('solar', () => {
  const initial = beijingNow()
  const active = ref(false)
  const date = ref(initial.date)
  const hour = ref(Math.round(initial.hour * 4) / 4)
  const isPlaying = ref(false)

  const utcMs = computed(() => Date.parse(`${date.value}T00:00:00Z`) + (hour.value - BEIJING_OFFSET_HOURS) * 3600000)
  const utcHour = computed(() => (((hour.value - BEIJING_OFFSET_HOURS) % 24) + 24) % 24)
  const parts = computed<DateParts>(() => datePartsOf(date.value))
  const beijingClock = computed(() => formatClock(hour.value))
  const utcClock = computed(() => formatClock(utcHour.value))

  function setActive(value: boolean): void {
    active.value = value
    if (!value) isPlaying.value = false
  }

  function setDate(value: string): void {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) date.value = value
  }

  function setHour(value: number): void {
    if (Number.isFinite(value)) hour.value = Math.min(24, Math.max(0, value))
  }

  function setPreset(preset: SolarPreset): void {
    const year = Number(date.value.slice(0, 4))
    if (Number.isFinite(year)) date.value = presetDate(preset, year)
  }

  function togglePlaying(): void {
    isPlaying.value = !isPlaying.value
  }

  function advance(dtSeconds: number): void {
    if (!isPlaying.value) return
    const next = hour.value + dtSeconds * HOURS_PER_SECOND
    if (next >= 24) {
      hour.value = next - 24
      date.value = shiftDate(date.value, 1)
    } else {
      hour.value = next
    }
  }

  return { active, date, hour, isPlaying, utcMs, utcHour, parts, beijingClock, utcClock, setActive, setDate, setHour, setPreset, togglePlaying, advance }
})
