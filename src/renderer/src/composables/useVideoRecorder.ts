import type { RecordingSaveResult } from '../../../preload'

export interface RecorderOverlay {
  title: string
  narration: string
}

const CANDIDATE_MIME_TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
const VIDEO_BITS_PER_SECOND = 8_000_000
const CAPTURE_FPS = 30
const FRAME_INTERVAL_MS = 1000 / CAPTURE_FPS
const FRAME_RESYNC_MS = 200
const MAX_CAPTURE_WIDTH = 1920
const MAX_CAPTURE_HEIGHT = 1080
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

export function captureSize(source: { width: number; height: number }): { width: number; height: number } {
  const scale = Math.min(1, MAX_CAPTURE_WIDTH / source.width, MAX_CAPTURE_HEIGHT / source.height)
  const even = (value: number): number => Math.max(2, Math.round(value / 2) * 2)
  return { width: even(source.width * scale), height: even(source.height * scale) }
}

export function createVideoRecorder(): {
  start: (source: HTMLCanvasElement, getOverlay: () => RecorderOverlay) => Promise<boolean>
  stop: () => Promise<RecordingSaveResult | null>
  pause: () => void
  resume: () => void
  isStarted: () => boolean
} {
  let recorder: MediaRecorder | null = null
  let mimeType = ''
  let recordingId: string | null = null
  let writeQueue: Promise<void> = Promise.resolve()
  let writeError: Error | null = null
  let composeCanvas: HTMLCanvasElement | null = null
  let composeContext: CanvasRenderingContext2D | null = null
  let stream: MediaStream | null = null
  let videoTrack: CanvasCaptureMediaStreamTrack | null = null
  let pacingTimer: number | undefined
  let nextFrameAt = 0
  let narrationLines: { text: string; size: number; maxWidth: number; lines: string[] } | null = null
  let sourceCanvas: HTMLCanvasElement | null = null
  let overlayProvider: (() => RecorderOverlay) | null = null

  function narrationTextLines(text: string, size: number, maxWidth: number): string[] {
    const context = composeContext
    if (!context) return []
    if (narrationLines && narrationLines.text === text && narrationLines.size === size && narrationLines.maxWidth === maxWidth) {
      return narrationLines.lines
    }
    const lines = wrapText(context, text, maxWidth)
    narrationLines = { text, size, maxWidth, lines }
    return lines
  }

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
    const lines = narrationTextLines(overlay.narration, size, maxWidth)
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

  function frameTick(): void {
    pacingTimer = undefined
    if (!recorder || recorder.state === 'inactive') return
    const now = performance.now()
    if (recorder.state === 'recording' && overlayProvider) {
      drawOverlay(overlayProvider())
      try {
        videoTrack?.requestFrame()
      } catch {}
    }
    nextFrameAt += FRAME_INTERVAL_MS
    if (now - nextFrameAt > FRAME_RESYNC_MS) nextFrameAt = now
    pacingTimer = window.setTimeout(frameTick, Math.max(0, nextFrameAt - performance.now()))
  }

  function appendChunk(chunk: Blob): void {
    writeQueue = writeQueue.then(async () => {
      if (writeError || !recordingId) return
      try {
        await window.guEarth.recordings.append(recordingId, await chunk.arrayBuffer())
      } catch (error) {
        writeError = error instanceof Error ? error : new Error('视频分段写入失败')
      }
    })
  }

  async function discardRecording(): Promise<void> {
    const id = recordingId
    recordingId = null
    if (!id) return
    try {
      await window.guEarth.recordings.abort(id)
    } catch {
      return
    }
  }

  async function start(source: HTMLCanvasElement, getOverlay: () => RecorderOverlay): Promise<boolean> {
    if (recorder && recorder.state !== 'inactive') return false
    if (typeof MediaRecorder === 'undefined') return false
    mimeType = CANDIDATE_MIME_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? ''
    composeCanvas = document.createElement('canvas')
    const size = captureSize(source)
    composeCanvas.width = size.width
    composeCanvas.height = size.height
    composeContext = composeCanvas.getContext('2d', { alpha: false })
    if (!composeContext) {
      cleanup()
      return false
    }
    sourceCanvas = source
    overlayProvider = getOverlay
    narrationLines = null
    drawOverlay(getOverlay())
    try {
      const manualStream = composeCanvas.captureStream(0)
      const track = manualStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined
      if (track && typeof track.requestFrame === 'function') {
        stream = manualStream
        videoTrack = track
      } else {
        for (const candidate of manualStream.getTracks()) candidate.stop()
        stream = composeCanvas.captureStream(CAPTURE_FPS)
        videoTrack = null
      }
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BITS_PER_SECOND })
        : new MediaRecorder(stream, { videoBitsPerSecond: VIDEO_BITS_PER_SECOND })
      if (!mimeType) mimeType = recorder.mimeType || 'video/webm'
      recordingId = await window.guEarth.recordings.start(mimeType)
      writeQueue = Promise.resolve()
      writeError = null
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) appendChunk(event.data)
      }
      recorder.start(1000)
    } catch (error) {
      await discardRecording()
      cleanup()
      throw error instanceof Error ? error : new Error('视频录制初始化失败')
    }
    nextFrameAt = performance.now() + FRAME_INTERVAL_MS
    pacingTimer = window.setTimeout(frameTick, FRAME_INTERVAL_MS)
    return true
  }

  function cleanup(): void {
    if (pacingTimer !== undefined) window.clearTimeout(pacingTimer)
    pacingTimer = undefined
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onstop = null
    }
    if (stream) for (const track of stream.getTracks()) track.stop()
    stream = null
    videoTrack = null
    recorder = null
    composeCanvas = null
    composeContext = null
    sourceCanvas = null
    overlayProvider = null
    narrationLines = null
  }

  function pause(): void {
    if (recorder && recorder.state === 'recording') recorder.pause()
  }

  function resume(): void {
    if (recorder && recorder.state === 'paused') recorder.resume()
  }

  async function stop(): Promise<RecordingSaveResult | null> {
    const active = recorder
    if (!active || active.state === 'inactive') {
      await discardRecording()
      cleanup()
      return null
    }
    try {
      const didStop = await new Promise<boolean>((resolve) => {
        const timeout = window.setTimeout(() => resolve(false), STOP_TIMEOUT_MS)
        active.onstop = () => {
          window.clearTimeout(timeout)
          resolve(true)
        }
        try {
          active.stop()
        } catch {
          window.clearTimeout(timeout)
          resolve(false)
        }
      })
      if (!didStop) throw new Error('等待视频编码器结束超时')
      await writeQueue
      if (writeError) throw writeError
      if (!recordingId) throw new Error('录制文件会话已失效')
      const result = await window.guEarth.recordings.finish(recordingId)
      recordingId = null
      return result
    } catch (error) {
      await writeQueue
      await discardRecording()
      throw error
    } finally {
      cleanup()
    }
  }

  function isStarted(): boolean {
    return Boolean(recorder && recorder.state !== 'inactive')
  }

  return { start, stop, pause, resume, isStarted }
}
