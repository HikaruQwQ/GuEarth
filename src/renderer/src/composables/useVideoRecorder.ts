export interface RecorderOverlay {
  title: string
  narration: string
}

export interface RecordedVideo {
  blob: Blob
  mimeType: string
}

const CANDIDATE_MIME_TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
const VIDEO_BITS_PER_SECOND = 8_000_000
const MAX_SUBTITLE_LINES = 3
const STOP_TIMEOUT_MS = 5000

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const character of text) {
    if (character === '\n') {
      lines.push(current)
      current = ''
      continue
    }
    const candidate = current + character
    if (context.measureText(candidate).width > maxWidth && current) {
      lines.push(current)
      current = character
      continue
    }
    current = candidate
  }
  if (current) lines.push(current)
  return lines.slice(0, MAX_SUBTITLE_LINES)
}

export function createVideoRecorder(): {
  start: (source: HTMLCanvasElement, getOverlay: () => RecorderOverlay) => boolean
  stop: () => Promise<RecordedVideo | null>
  pause: () => void
  resume: () => void
  isStarted: () => boolean
} {
  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let mimeType = ''
  let composeCanvas: HTMLCanvasElement | null = null
  let composeContext: CanvasRenderingContext2D | null = null
  let stream: MediaStream | null = null
  let rafId = 0
  let sourceCanvas: HTMLCanvasElement | null = null
  let overlayProvider: (() => RecorderOverlay) | null = null

  function drawOverlay(overlay: RecorderOverlay): void {
    const context = composeContext
    const canvas = composeCanvas
    if (!context || !canvas || !sourceCanvas) return
    const { width, height } = canvas
    context.clearRect(0, 0, width, height)
    context.drawImage(sourceCanvas as HTMLCanvasElement, 0, 0, width, height)
    if (overlay.title) {
      const size = Math.max(18, Math.round(height * 0.026))
      context.font = `600 ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`
      context.textBaseline = 'top'
      context.textAlign = 'left'
      context.lineWidth = Math.max(3, size * 0.16)
      context.strokeStyle = 'rgba(0, 0, 0, 0.75)'
      context.fillStyle = 'rgba(255, 255, 255, 0.95)'
      const titleX = width * 0.04
      const titleY = height * 0.045
      context.strokeText(overlay.title, titleX, titleY)
      context.fillText(overlay.title, titleX, titleY)
    }
    if (!overlay.narration) return
    const size = Math.max(22, Math.round(height * 0.036))
    context.font = `600 ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`
    context.textBaseline = 'bottom'
    context.textAlign = 'center'
    const maxWidth = width * 0.82
    const lines = wrapText(context, overlay.narration, maxWidth)
    const lineHeight = size * 1.4
    const boxHeight = lines.length * lineHeight + size * 0.7
    const boxTop = height - height * 0.05 - boxHeight
    const gradient = context.createLinearGradient(0, boxTop - lineHeight, 0, height)
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
    gradient.addColorStop(0.45, 'rgba(0, 0, 0, 0.62)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.72)')
    context.fillStyle = gradient
    context.fillRect(0, boxTop - lineHeight, width, height - boxTop + lineHeight)
    context.lineWidth = Math.max(3, size * 0.14)
    context.strokeStyle = 'rgba(0, 0, 0, 0.85)'
    context.fillStyle = 'rgba(255, 255, 255, 0.97)'
    lines.forEach((line, index) => {
      const y = boxTop + (index + 1) * lineHeight
      context.strokeText(line, width / 2, y)
      context.fillText(line, width / 2, y)
    })
  }

  function renderFrame(): void {
    if (!recorder || recorder.state === 'inactive') return
    if (overlayProvider) drawOverlay(overlayProvider())
    rafId = requestAnimationFrame(renderFrame)
  }

  function start(source: HTMLCanvasElement, getOverlay: () => RecorderOverlay): boolean {
    if (recorder && recorder.state !== 'inactive') return false
    if (typeof MediaRecorder === 'undefined') return false
    mimeType = CANDIDATE_MIME_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? ''
    composeCanvas = document.createElement('canvas')
    composeCanvas.width = Math.max(2, source.width)
    composeCanvas.height = Math.max(2, source.height)
    composeContext = composeCanvas.getContext('2d', { alpha: false })
    if (!composeContext) return false
    sourceCanvas = source
    overlayProvider = getOverlay
    drawOverlay(getOverlay())
    try {
      stream = composeCanvas.captureStream(30)
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BITS_PER_SECOND })
        : new MediaRecorder(stream, { videoBitsPerSecond: VIDEO_BITS_PER_SECOND })
      if (!mimeType) mimeType = recorder.mimeType || 'video/webm'
    } catch {
      cleanup()
      return false
    }
    chunks = []
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data)
    }
    recorder.start(1000)
    rafId = requestAnimationFrame(renderFrame)
    return true
  }

  function cleanup(): void {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    if (stream) for (const track of stream.getTracks()) track.stop()
    stream = null
    recorder = null
    composeCanvas = null
    composeContext = null
    sourceCanvas = null
    overlayProvider = null
  }

  function pause(): void {
    if (recorder && recorder.state === 'recording') recorder.pause()
  }

  function resume(): void {
    if (recorder && recorder.state === 'paused') recorder.resume()
  }

  async function stop(): Promise<RecordedVideo | null> {
    const active = recorder
    if (!active || active.state === 'inactive') {
      cleanup()
      return null
    }
    const settled = new Promise<RecordedVideo | null>((resolve) => {
      active.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType })
        resolve(blob.size > 0 ? { blob, mimeType } : null)
      }
      setTimeout(() => resolve(null), STOP_TIMEOUT_MS)
    })
    try {
      active.stop()
    } catch {
      cleanup()
      return null
    }
    const result = await settled
    cleanup()
    return result
  }

  function isStarted(): boolean {
    return Boolean(recorder && recorder.state !== 'inactive')
  }

  return { start, stop, pause, resume, isStarted }
}
