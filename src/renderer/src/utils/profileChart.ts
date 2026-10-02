import type { ProfileSample } from './geo'

const PADDING = { left: 48, right: 12, top: 14, bottom: 24 }

export function drawProfileChart(ctx: CanvasRenderingContext2D, profile: ProfileSample[], width: number, height: number): void {
  if (profile.length < 2) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  const plotWidth = width - PADDING.left - PADDING.right
  const plotHeight = height - PADDING.top - PADDING.bottom
  const maxDistance = profile[profile.length - 1].distanceKm || 1
  const elevations = profile.map((sample) => sample.elevation)
  const rawMin = Math.min(...elevations)
  const rawMax = Math.max(...elevations)
  const elevationPad = (rawMax - rawMin) * 0.15 || 40
  const minElevation = Math.max(0, rawMin - elevationPad)
  const maxElevation = rawMax + elevationPad
  const xFor = (distance: number): number => PADDING.left + (distance / maxDistance) * plotWidth
  const yFor = (elevation: number): number => PADDING.top + (1 - (elevation - minElevation) / (maxElevation - minElevation || 1)) * plotHeight
  ctx.strokeStyle = 'rgba(5,5,5,0.08)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = PADDING.top + (plotHeight * i) / 4
    ctx.beginPath()
    ctx.moveTo(PADDING.left, y)
    ctx.lineTo(width - PADDING.right, y)
    ctx.stroke()
  }
  for (let i = 0; i <= 4; i++) {
    const x = PADDING.left + (plotWidth * i) / 4
    ctx.beginPath()
    ctx.moveTo(x, PADDING.top)
    ctx.lineTo(x, height - PADDING.bottom)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(xFor(profile[0].distanceKm), yFor(profile[0].elevation))
  profile.forEach((sample) => ctx.lineTo(xFor(sample.distanceKm), yFor(sample.elevation)))
  ctx.lineTo(xFor(maxDistance), height - PADDING.bottom)
  ctx.lineTo(xFor(0), height - PADDING.bottom)
  ctx.closePath()
  ctx.fillStyle = 'rgba(22,119,255,0.14)'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(xFor(profile[0].distanceKm), yFor(profile[0].elevation))
  profile.forEach((sample) => ctx.lineTo(xFor(sample.distanceKm), yFor(sample.elevation)))
  ctx.strokeStyle = '#1677ff'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.font = '10px Consolas, monospace'
  for (let i = 0; i <= 2; i++) {
    const elevation = minElevation + ((maxElevation - minElevation) * i) / 2
    const y = yFor(elevation)
    ctx.fillText(`${Math.round(elevation)}m`, 4, y + 3)
  }
  ctx.fillText('0', PADDING.left - 4, height - 8)
  const midLabel = `${(maxDistance / 2).toFixed(1)}km`
  ctx.fillText(midLabel, PADDING.left + plotWidth / 2 - midLabel.length * 2, height - 8)
  const maxLabel = `${maxDistance.toFixed(1)}km`
  ctx.fillText(maxLabel, width - PADDING.right - maxLabel.length * 6, height - 8)
}
