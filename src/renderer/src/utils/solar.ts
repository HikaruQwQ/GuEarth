export interface SolarPosition {
  latitude: number
  longitude: number
}

export interface SolarDateInput {
  year: number
  month: number
  day: number
}

const OBLIQUITY_DEGREES = 23.44
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function dayOfYear(input: SolarDateInput): number {
  let total = 0
  for (let month = 1; month < input.month; month++) {
    total += month === 2 && isLeapYear(input.year) ? 29 : DAYS_IN_MONTH[month - 1]
  }
  return total + input.day
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

export function solarDeclination(input: SolarDateInput): number {
  const n = dayOfYear(input)
  const span = daysInYear(input.year)
  return -OBLIQUITY_DEGREES * Math.cos((2 * Math.PI * (n + 10)) / span)
}

export function equationOfTimeMinutes(input: SolarDateInput): number {
  const n = dayOfYear(input)
  const b = (2 * Math.PI * (n - 81)) / 364
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
}

function wrapLongitude(lon: number): number {
  let value = ((lon + 180) % 360 + 360) % 360 - 180
  if (value === -180) value = 180
  return value
}

export function subsolarPoint(input: SolarDateInput, utcHours: number): SolarPosition {
  const declination = solarDeclination(input)
  const eot = equationOfTimeMinutes(input)
  const longitude = -15 * (utcHours - 12 + eot / 60)
  return { latitude: declination, longitude: wrapLongitude(longitude) }
}

export function dayLengthHours(latitude: number, declinationDeg: number): number {
  const tanProduct = Math.tan(toRadians(latitude)) * Math.tan(toRadians(declinationDeg))
  if (tanProduct >= 1) return 24
  if (tanProduct <= -1) return 0
  const hourAngle = Math.acos(-tanProduct)
  return (24 / Math.PI) * hourAngle
}

export function noonSolarElevation(latitude: number, declinationDeg: number): number {
  return 90 - Math.abs(latitude - declinationDeg)
}

export function formatUtcHours(utcHours: number): string {
  const clamped = Math.min(24, Math.max(0, utcHours))
  const wrapped = Math.round(clamped * 60) % (24 * 60)
  const hours = Math.floor(wrapped / 60)
  const minutes = wrapped % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function formatLatitude(latitude: number): string {
  const rounded = Math.abs(latitude) < 0.05 ? 0 : latitude
  return `${Math.abs(rounded).toFixed(1)}°${rounded >= 0 ? 'N' : 'S'}`
}

export function formatLongitude(longitude: number): string {
  const rounded = Math.abs(longitude) < 0.05 ? 0 : longitude
  return `${Math.abs(rounded).toFixed(1)}°${rounded >= 0 ? 'E' : 'W'}`
}

type Vec3 = [number, number, number]

function subsolarVector(subsolarLat: number, subsolarLon: number): Vec3 {
  const lat = toRadians(subsolarLat)
  const lon = toRadians(subsolarLon)
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
}

export function terminatorRing(subsolarLat: number, subsolarLon: number, stepDegrees = 3): Array<[number, number]> {
  const s = subsolarVector(subsolarLat, subsolarLon)
  const k: Vec3 = Math.abs(s[2]) < 0.99 ? [0, 0, 1] : [1, 0, 0]
  let e1: Vec3 = [s[1] * k[2] - s[2] * k[1], s[2] * k[0] - s[0] * k[2], s[0] * k[1] - s[1] * k[0]]
  const e1Length = Math.hypot(e1[0], e1[1], e1[2])
  e1 = [e1[0] / e1Length, e1[1] / e1Length, e1[2] / e1Length]
  const e2: Vec3 = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]]
  const ring: Array<[number, number]> = []
  for (let theta = 0; theta < 360; theta += stepDegrees) {
    const rad = toRadians(theta)
    const x = Math.cos(rad) * e1[0] + Math.sin(rad) * e2[0]
    const y = Math.cos(rad) * e1[1] + Math.sin(rad) * e2[1]
    const z = Math.cos(rad) * e1[2] + Math.sin(rad) * e2[2]
    const lat = toDegrees(Math.asin(z))
    const lon = wrapLongitude(toDegrees(Math.atan2(y, x)))
    ring.push([lon, lat])
  }
  ring.push(ring[0])
  return ring
}

export function hemisphereHint(subsolarLat: number): string {
  if (subsolarLat > 2) return '直射点在北半球：北半球昼长夜短，全球气压带风带北移'
  if (subsolarLat < -2) return '直射点在南半球：北半球昼短夜长，全球气压带风带南移'
  return '直射点在赤道附近：全球昼夜平分'
}
