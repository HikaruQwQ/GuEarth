import { ref } from 'vue'
import { defineStore } from 'pinia'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function isoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

export function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const parts = value.split('-').map((part) => Number.parseInt(part, 10))
  const year = parts[0] ?? 2025
  const month = Math.min(12, Math.max(1, parts[1] ?? 1))
  const day = Math.min(31, Math.max(1, parts[2] ?? 1))
  return { year, month, day }
}

export const useSolarStore = defineStore('solar', () => {
  const panelOpen = ref(false)
  const showTerminator = ref(true)
  const showSubsolar = ref(true)
  const showLighting = ref(true)
  const playing = ref(false)
  const speed = ref(1)
  const dateISO = ref(isoDate(new Date()))
  const utcHours = ref(new Date().getUTCHours() + new Date().getUTCMinutes() / 60)

  function setPanelOpen(value: boolean): void {
    panelOpen.value = value
  }

  function setDate(value: string): void {
    dateISO.value = value
  }

  function setUtcHours(value: number): void {
    utcHours.value = Math.min(24, Math.max(0, value))
  }

  function setSpeed(value: number): void {
    speed.value = value
  }

  function togglePlay(): void {
    playing.value = !playing.value
  }

  function toggleShow(key: 'terminator' | 'subsolar' | 'lighting', value: boolean): void {
    if (key === 'terminator') showTerminator.value = value
    else if (key === 'subsolar') showSubsolar.value = value
    else showLighting.value = value
  }

  function advanceTime(deltaHours: number): void {
    const total = utcHours.value + deltaHours
    if (total >= 24) {
      utcHours.value = total % 24
      const next = parseIsoDate(dateISO.value)
      const maxDay = new Date(Date.UTC(next.year, next.month, 0)).getUTCDate()
      const day = next.day >= maxDay ? 1 : next.day + 1
      const month = next.day >= maxDay ? (next.month >= 12 ? 1 : next.month + 1) : next.month
      const year = next.day >= maxDay && next.month >= 12 ? next.year + 1 : next.year
      dateISO.value = `${year}-${pad2(month)}-${pad2(day)}`
    } else {
      utcHours.value = Math.max(0, total)
    }
  }

  return {
    panelOpen, showTerminator, showSubsolar, showLighting, playing, speed, dateISO, utcHours,
    setPanelOpen, setDate, setUtcHours, setSpeed, togglePlay, toggleShow, advanceTime
  }
})
