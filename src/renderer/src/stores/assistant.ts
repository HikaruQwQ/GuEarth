import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { AiChatMessage, AiChatToolCall, AiChunkEvent, AiConfigInfo, GeoBounds, PeakResult, PlaceResult } from '../../../preload/types'
import { useMonsoonStore } from '@renderer/stores/monsoon'
import { climateRegionAt, latitudeZoneName } from '@renderer/utils/climateData'

export interface AssistantToolChip {
  name: string
  detail: string
}

export interface AssistantResultItem {
  name: string
  subtitle: string
  lon: number
  lat: number
  elevation?: number
}

export interface AssistantMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  tools?: AssistantToolChip[]
  result?: { kind: 'places' | 'peaks'; items: AssistantResultItem[] }
}

export interface AssistantTools {
  flyTo: (lon: number, lat: number, height?: number) => void
  viewBounds: () => GeoBounds | null
  camera: () => { longitude: number; latitude: number; height: number }
  setMonth: (month: number) => void
  dropMarker: (lon: number, lat: number, name: string) => void
  terrainAt: (lon: number, lat: number) => number | null
}

const TOOL_LABELS: Record<string, string> = {
  fly_to: '飞行定位',
  search_places: '搜索地名',
  find_peaks: '地貌选点',
  get_current_view: '读取视野',
  set_month: '切换月份',
  explain_climate: '气候成因'
}

const MAX_TOOL_ROUNDS = 4
const REQUEST_TIMEOUT_MS = 200000

export const useAssistantStore = defineStore('assistant', () => {
  const open = ref(false)
  const messages = ref<AssistantMessage[]>([])
  const busy = ref(false)
  const error = ref('')
  const config = ref<AiConfigInfo>({ configured: false, baseUrl: '', model: '' })
  const settingsOpen = ref(false)
  const draftBaseUrl = ref('')
  const draftModel = ref('deepseek-chat')
  const draftApiKey = ref('')

  let tools: AssistantTools | null = null
  let history: AiChatMessage[] = []
  let messageSeq = 0
  let requestSeq = 0
  let activeRequestId = ''

  function registerTools(value: AssistantTools): void {
    tools = value
  }

  function pushMessage(message: Omit<AssistantMessage, 'id'>): number {
    const id = ++messageSeq
    messages.value = [...messages.value, { id, ...message }]
    return id
  }

  function updateMessage(id: number, updater: (message: AssistantMessage) => AssistantMessage): void {
    messages.value = messages.value.map((message) => (message.id === id ? updater(message) : message))
  }

  function appendToMessage(id: number, delta: string): void {
    updateMessage(id, (message) => ({ ...message, content: message.content + delta }))
  }

  function patchChip(id: number, name: string, detail: string): void {
    const label = TOOL_LABELS[name] ?? name
    updateMessage(id, (message) => {
      const chips = message.tools ?? []
      const existing = chips.find((chip) => chip.name === label)
      const next = existing
        ? chips.map((chip) => (chip.name === label ? { ...chip, detail } : chip))
        : [...chips, { name: label, detail }]
      return { ...message, tools: next }
    })
  }

  function setOpen(value: boolean): void {
    open.value = value
    if (value) void loadConfig()
  }

  async function loadConfig(): Promise<void> {
    try {
      config.value = await window.guEarth.ai.getConfig()
      draftBaseUrl.value = config.value.baseUrl
      draftModel.value = config.value.model || 'deepseek-chat'
    } catch {
      config.value = { configured: false, baseUrl: '', model: '' }
    }
  }

  async function saveConfig(): Promise<void> {
    try {
      config.value = await window.guEarth.ai.saveConfig({
        baseUrl: draftBaseUrl.value.trim(),
        model: draftModel.value.trim() || 'deepseek-chat',
        apiKey: draftApiKey.value ? draftApiKey.value : undefined
      })
      draftApiKey.value = ''
      settingsOpen.value = false
      error.value = ''
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'AI 配置保存失败'
    }
  }

  function placesCard(items: PlaceResult[]): void {
    pushMessage({
      role: 'assistant',
      content: '',
      result: {
        kind: 'places',
        items: items.map((item) => ({ name: item.name, subtitle: item.detail, lon: item.lon, lat: item.lat }))
      }
    })
  }

  function peaksCard(items: PeakResult[]): void {
    pushMessage({
      role: 'assistant',
      content: '',
      result: {
        kind: 'peaks',
        items: items.map((item) => ({ name: item.name, subtitle: `海拔 ${Math.round(item.elevation)} m`, lon: item.lon, lat: item.lat, elevation: item.elevation }))
      }
    })
  }

  function focusItem(item: AssistantResultItem): void {
    if (!tools) return
    tools.flyTo(item.lon, item.lat, item.elevation !== undefined ? Math.max(item.elevation * 6, 12000) : undefined)
    tools.dropMarker(item.lon, item.lat, item.name)
  }

  function requireBounds(): GeoBounds {
    const bounds = tools?.viewBounds()
    if (!bounds) throw new Error('无法获取当前视野，请稍后重试')
    return bounds
  }

  async function executeTool(call: AiChatToolCall, messageId: number): Promise<string> {
    let args: Record<string, unknown> = {}
    try {
      args = call.args ? (JSON.parse(call.args) as Record<string, unknown>) : {}
    } catch {
      return `工具 ${call.name} 参数解析失败`
    }
    if (!tools) return '地球工具未就绪'
    try {
      if (call.name === 'fly_to') {
        const lon = Number(args.longitude)
        const lat = Number(args.latitude)
        const height = args.height === undefined ? undefined : Number(args.height)
        if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return 'fly_to 参数无效'
        tools.flyTo(lon, lat, Number.isFinite(height as number) ? (height as number) : undefined)
        patchChip(messageId, call.name, `${lat.toFixed(2)}, ${lon.toFixed(2)}`)
        return `已飞往经度 ${lon}、纬度 ${lat}${height ? `，高度 ${height} 米` : ''}`
      }
      if (call.name === 'search_places') {
        const query = String(args.query ?? '').trim()
        if (!query) return 'search_places 缺少 query'
        patchChip(messageId, call.name, '检索中')
        const places = await window.guEarth.places.search(query)
        placesCard(places)
        patchChip(messageId, call.name, `${places.length} 个结果`)
        return places.length
          ? `找到 ${places.length} 个结果：${places.slice(0, 5).map((place) => `${place.name}(${place.lat.toFixed(2)}, ${place.lon.toFixed(2)})`).join('；')}。结果列表已展示给用户，可对最相关的结果 fly_to。`
          : '没有找到匹配的地点，建议用户换个关键词。'
      }
      if (call.name === 'find_peaks') {
        const minElevation = args.min_elevation === undefined ? 0 : Number(args.min_elevation)
        patchChip(messageId, call.name, '检索中')
        const peaks = await window.guEarth.places.peaks(requireBounds(), Number.isFinite(minElevation) ? minElevation : 0)
        peaksCard(peaks)
        patchChip(messageId, call.name, `${peaks.length} 个结果`)
        if (peaks.length) tools.flyTo(peaks[0].lon, peaks[0].lat, Math.max(peaks[0].elevation * 6, 12000))
        return peaks.length
          ? `视野内共 ${peaks.length} 座山峰/火山，最高的是 ${peaks[0].name}（${Math.round(peaks[0].elevation)} m）。列表已展示，并已飞往最高点。`
          : '当前视野内没有符合条件的地貌点，可建议用户缩小范围或降低海拔门槛。'
      }
      if (call.name === 'get_current_view') {
        const camera = tools.camera()
        const bounds = tools.viewBounds()
        patchChip(messageId, call.name, `${camera.latitude.toFixed(2)}, ${camera.longitude.toFixed(2)}`)
        return JSON.stringify({ camera, bounds })
      }
      if (call.name === 'set_month') {
        const month = Number(args.month)
        if (!Number.isFinite(month)) return 'set_month 参数无效'
        const clamped = Math.min(12, Math.max(1, Math.round(month)))
        tools.setMonth(clamped)
        useMonsoonStore().setPanelOpen(true)
        patchChip(messageId, call.name, `${clamped} 月`)
        return `已把季风气候实验室切换到 ${clamped} 月`
      }
      if (call.name === 'explain_climate') {
        const lon = Number(args.longitude)
        const lat = Number(args.latitude)
        if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return 'explain_climate 参数无效'
        const region = climateRegionAt(lon, lat)
        const elevation = tools.terrainAt(lon, lat)
        patchChip(messageId, call.name, `${lat.toFixed(2)}, ${lon.toFixed(2)}`)
        return JSON.stringify({
          longitude: lon,
          latitude: lat,
          latitudeZone: latitudeZoneName(lat),
          climateRegion: region ? `${region.name}（柯本 ${region.koppen}）` : '未收录的典型气候区，请按纬度带和海陆位置推断',
          elevationMeters: elevation === null ? '未知' : Math.round(elevation),
          currentDemoMonth: useMonsoonStore().month
        })
      }
      return `未知工具 ${call.name}`
    } catch (cause) {
      patchChip(messageId, call.name, '失败')
      return cause instanceof Error ? cause.message : '工具执行失败'
    }
  }

  async function llmTurn(streamMessageId: number, depth: number): Promise<void> {
    if (depth >= MAX_TOOL_ROUNDS) {
      updateMessage(streamMessageId, (message) => ({ ...message, streaming: false }))
      return
    }
    const requestId = `chat-${Date.now()}-${++requestSeq}`
    activeRequestId = requestId
    let resolveFinal: ((value: AiChunkEvent | null) => void) | null = null
    const finished = new Promise<AiChunkEvent | null>((resolve) => {
      resolveFinal = resolve
    })
    const unsubscribe = window.guEarth.ai.onChunk((event) => {
      if (event.requestId !== requestId) return
      if (event.type === 'text') {
        appendToMessage(streamMessageId, event.value)
        return
      }
      unsubscribe()
      resolveFinal?.(event)
    })
    const timeout = window.setTimeout(() => {
      unsubscribe()
      resolveFinal?.(null)
    }, REQUEST_TIMEOUT_MS)
    try {
      await window.guEarth.ai.chat(requestId, history)
    } catch (cause) {
      clearTimeout(timeout)
      unsubscribe()
      updateMessage(streamMessageId, (message) => ({ ...message, streaming: false }))
      error.value = cause instanceof Error ? cause.message : 'AI 请求失败'
      return
    }
    const final = await finished
    clearTimeout(timeout)
    activeRequestId = ''
    updateMessage(streamMessageId, (message) => ({ ...message, streaming: false, content: message.content }))
    if (!final || final.type !== 'end') {
      if (final?.type === 'error') error.value = final.message
      return
    }
    if (final.content) updateMessage(streamMessageId, (message) => ({ ...message, content: final.content }))
    history = [...history, { role: 'assistant', content: final.content, toolCalls: final.toolCalls.length ? final.toolCalls : undefined }]
    if (!final.toolCalls.length) return
    for (const call of final.toolCalls) {
      const result = await executeTool(call, streamMessageId)
      history = [...history, { role: 'tool', content: result, toolCallId: call.id }]
    }
    const followUpId = pushMessage({ role: 'assistant', content: '', streaming: true })
    await llmTurn(followUpId, depth + 1)
  }

  async function ruleTurn(text: string): Promise<void> {
    const messageId = pushMessage({ role: 'assistant', content: '', streaming: true, tools: [] })
    try {
      const peakIntent = /山峰|高峰|火山|最高|海拔|地貌/.test(text)
      const meterMatch = text.match(/(\d{3,5})\s*米/)
      if (peakIntent) {
        patchChip(messageId, 'find_peaks', '检索中')
        const peaks = await window.guEarth.places.peaks(requireBounds(), meterMatch ? Number(meterMatch[1]) : 0)
        patchChip(messageId, 'find_peaks', `${peaks.length} 个结果`)
        if (peaks.length) {
          peaksCard(peaks)
          tools?.flyTo(peaks[0].lon, peaks[0].lat, Math.max(peaks[0].elevation * 6, 12000))
          updateMessage(messageId, (message) => ({
            ...message,
            content: `当前视野内检索到 ${peaks.length} 个地貌点，已按海拔排序并飞往最高的 ${peaks[0].name}（${Math.round(peaks[0].elevation)} m）。点击列表可在地球上定位。`
          }))
        } else {
          updateMessage(messageId, (message) => ({
            ...message,
            content: '当前视野内没有找到符合条件的地貌点。可以先把地球缩放到具体区域，或降低海拔门槛后再试。'
          }))
        }
      } else {
        const query = text.replace(/^(帮我|请|麻烦)?(搜索|查找|找找|找一下|找|看看|定位|去)/, '').trim() || text
        patchChip(messageId, 'search_places', '检索中')
        const places = await window.guEarth.places.search(query)
        patchChip(messageId, 'search_places', `${places.length} 个结果`)
        placesCard(places)
        if (places.length) {
          tools?.flyTo(places[0].lon, places[0].lat)
          tools?.dropMarker(places[0].lon, places[0].lat, places[0].name)
          updateMessage(messageId, (message) => ({
            ...message,
            content: `找到 ${places.length} 个与「${query}」相关的地点，已飞往第一个结果。点击列表项可在地球上标记定位。`
          }))
        } else {
          updateMessage(messageId, (message) => ({
            ...message,
            content: `没有找到「${query}」相关的地点，换个关键词试试，例如「喜马拉雅山脉」「长江中下游平原」。`
          }))
        }
      }
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '检索失败'
      updateMessage(messageId, (message) => ({ ...message, content: '检索失败了，请检查网络后重试。' }))
    } finally {
      updateMessage(messageId, (message) => ({ ...message, streaming: false }))
    }
  }

  async function send(rawText: string): Promise<void> {
    const text = rawText.trim()
    if (!text || busy.value) return
    error.value = ''
    pushMessage({ role: 'user', content: text })
    busy.value = true
    try {
      if (config.value.configured) {
        history = [...history, { role: 'user', content: text }]
        const streamMessageId = pushMessage({ role: 'assistant', content: '', streaming: true })
        await llmTurn(streamMessageId, 0)
      } else {
        await ruleTurn(text)
      }
    } finally {
      busy.value = false
    }
  }

  function stop(): void {
    if (!busy.value || !activeRequestId) return
    const last = messages.value[messages.value.length - 1]
    if (last?.role === 'assistant') updateMessage(last.id, (message) => ({ ...message, streaming: false }))
    void window.guEarth.ai.abort(activeRequestId)
    activeRequestId = ''
  }

  function clear(): void {
    messages.value = []
    history = []
    error.value = ''
  }

  return {
    open, messages, busy, error, config, settingsOpen, draftBaseUrl, draftModel, draftApiKey,
    registerTools, setOpen, loadConfig, saveConfig, send, stop, clear, focusItem
  }
})
