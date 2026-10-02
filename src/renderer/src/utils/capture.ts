import * as Cesium from 'cesium'
import type { LegendSection } from './legendEntries'
import type { ScaleBarReadout } from '@renderer/composables/useScaleBar'

export interface ComposeOptions {
  title: string
  dateText: string
  sections: LegendSection[]
  scaleBar: ScaleBarReadout | null
  heading: number
  displayScale: number
  includeLegend: boolean
  includeScale: boolean
  includeNorth: boolean
  includeDate: boolean
}

const FONT_BASE = `-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif`

export async function captureScene(viewer: Cesium.Viewer, factor: number): Promise<HTMLCanvasElement | null> {
  const previous = viewer.resolutionScale
  try {
    viewer.resolutionScale = previous * factor
    viewer.scene.render()
    const canvas = document.createElement('canvas')
    canvas.width = viewer.canvas.width
    canvas.height = viewer.canvas.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(viewer.canvas, 0, 0)
    return canvas
  } catch {
    return null
  } finally {
    viewer.resolutionScale = previous
    viewer.scene.render()
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function card(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  ctx.save()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  roundRect(ctx, x, y, width, height, 8)
  ctx.fill()
  ctx.strokeStyle = 'rgba(5, 5, 5, 0.08)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

function drawShape(ctx: CanvasRenderingContext2D, color: string, shape: string, x: number, centerY: number): void {
  ctx.save()
  if (shape === 'dot') {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x + 5, centerY, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(5, 5, 5, 0.25)'
    ctx.stroke()
  } else if (shape === 'fill') {
    ctx.globalAlpha = 0.7
    ctx.fillStyle = color
    ctx.fillRect(x, centerY - 6, 12, 12)
    ctx.globalAlpha = 1
    ctx.strokeStyle = color
    ctx.strokeRect(x, centerY - 6, 12, 12)
  } else if (shape === 'dash') {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(x, centerY)
    ctx.lineTo(x + 18, centerY)
    ctx.stroke()
  } else {
    ctx.fillStyle = color
    roundRect(ctx, x, centerY - 2, 18, 4, 2)
    ctx.fill()
    if (shape === 'arrow') {
      ctx.beginPath()
      ctx.moveTo(x + 18, centerY - 5)
      ctx.lineTo(x + 24, centerY)
      ctx.lineTo(x + 18, centerY + 5)
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.restore()
}

export function composeExportImage(base: HTMLCanvasElement, options: ComposeOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = base.width
  canvas.height = base.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return base
  ctx.drawImage(base, 0, 0)
  const s = options.displayScale
  ctx.save()
  ctx.scale(s, s)
  const cssWidth = base.width / s
  const cssHeight = base.height / s
  const margin = 16

  if (options.title || options.includeDate) {
    ctx.font = `600 16px ${FONT_BASE}`
    const titleWidth = options.title ? ctx.measureText(options.title).width : 0
    ctx.font = `400 12px ${FONT_BASE}`
    const dateWidth = options.includeDate ? ctx.measureText(options.dateText).width : 0
    const cardWidth = 16 + Math.max(titleWidth, dateWidth)
    const cardHeight = 12 + (options.title ? 24 : 0) + (options.includeDate ? 20 : 0)
    card(ctx, margin, margin, cardWidth, cardHeight)
    let cursorY = margin + 12
    if (options.title) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'
      ctx.font = `600 16px ${FONT_BASE}`
      ctx.textBaseline = 'top'
      ctx.fillText(options.title, margin + 8, cursorY)
      cursorY += 24
    }
    if (options.includeDate) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
      ctx.font = `400 12px ${FONT_BASE}`
      ctx.fillText(options.dateText, margin + 8, cursorY)
    }
  }

  if (options.includeLegend && options.sections.length > 0) {
    const itemGap = 16
    ctx.font = `400 12px ${FONT_BASE}`
    let cardWidth = 0
    for (const section of options.sections) {
      let rowWidth = 8
      ctx.font = `600 13px ${FONT_BASE}`
      rowWidth += ctx.measureText(section.title).width + 12
      ctx.font = `400 12px ${FONT_BASE}`
      for (const item of section.items) rowWidth += 26 + ctx.measureText(item.label).width + itemGap
      cardWidth = Math.max(cardWidth, rowWidth)
    }
    cardWidth = Math.min(cardWidth + 8, cssWidth - margin * 2)
    const cardHeight = 12 + options.sections.length * 24
    const cardY = cssHeight - margin - cardHeight
    card(ctx, margin, cardY, cardWidth, cardHeight)
    let y = cardY + 6
    for (const section of options.sections) {
      let x = margin + 12
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.font = `600 13px ${FONT_BASE}`
      ctx.textBaseline = 'middle'
      ctx.fillText(section.title, x, y + 10)
      x += ctx.measureText(section.title).width + 12
      ctx.font = `400 12px ${FONT_BASE}`
      for (const item of section.items) {
        drawShape(ctx, item.color, item.shape, x, y + 10)
        x += item.shape === 'arrow' ? 30 : 26
        ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'
        ctx.fillText(item.label, x, y + 10)
        x += ctx.measureText(item.label).width + itemGap
      }
      y += 24
    }
  }

  if (options.includeScale && options.scaleBar) {
    ctx.font = `400 12px ${FONT_BASE}`
    const textWidth = ctx.measureText(options.scaleBar.label).width
    const cardWidth = 20 + Math.max(options.scaleBar.widthPx, textWidth)
    const cardHeight = 44
    const cardX = cssWidth - margin - cardWidth
    const cardY = cssHeight - margin - cardHeight
    card(ctx, cardX, cardY, cardWidth, cardHeight)
    const lineY = cardY + 14
    const lineX = cardX + 10
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(lineX, lineY)
    ctx.lineTo(lineX + options.scaleBar.widthPx, lineY)
    ctx.moveTo(lineX, lineY - 4)
    ctx.lineTo(lineX, lineY + 4)
    ctx.moveTo(lineX + options.scaleBar.widthPx, lineY - 4)
    ctx.lineTo(lineX + options.scaleBar.widthPx, lineY + 4)
    ctx.stroke()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'
    ctx.font = `400 12px ${FONT_BASE}`
    ctx.textBaseline = 'top'
    ctx.fillText(options.scaleBar.label, lineX, lineY + 6)
  }

  if (options.includeNorth) {
    const radius = 22
    const centerX = cssWidth - margin - radius - 8
    const centerY = margin + radius + 8
    card(ctx, centerX - radius, centerY - radius, radius * 2, radius * 2)
    ctx.strokeStyle = 'rgba(5, 5, 5, 0.15)'
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius - 4, 0, Math.PI * 2)
    ctx.stroke()
    const rotation = (-options.heading * Math.PI) / 180
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rotation)
    ctx.fillStyle = '#1677ff'
    ctx.beginPath()
    ctx.moveTo(0, -(radius - 8))
    ctx.lineTo(5, 0)
    ctx.lineTo(-5, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.beginPath()
    ctx.moveTo(0, radius - 8)
    ctx.lineTo(5, 0)
    ctx.lineTo(-5, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'
    ctx.font = `600 10px ${FONT_BASE}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('N', 0, -(radius - 8) - 1)
    ctx.restore()
  }

  ctx.restore()
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk))
  }
  return btoa(binary)
}
