import { ipcMain, safeStorage } from 'electron'

export interface AiChatToolCall {
  id: string
  name: string
  args: string
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: AiChatToolCall[]
}

export interface AiConfigAdapter {
  getBaseUrl: () => string
  getModel: () => string
  getApiKey: () => string | undefined
  setApiKey: (apiKey: string) => void
  clearApiKey: () => void
}

const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'fly_to',
      description: '将地球相机飞到指定经纬度。用于展示用户提到的地点或检索结果。',
      parameters: {
        type: 'object',
        properties: {
          longitude: { type: 'number', description: '经度，-180 到 180' },
          latitude: { type: 'number', description: '纬度，-90 到 90' },
          height: { type: 'number', description: '相机高度（米），省略时自动选择' }
        },
        required: ['longitude', 'latitude']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_places',
      description: '按名称搜索全球地名（城市、山脉、河流、行政区等），返回经纬度列表。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '地名关键词，可中可英' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'find_peaks',
      description: '在当前地球视野范围内检索山峰/火山（含海拔），按海拔从高到低返回。用于按地貌地形特征选点。',
      parameters: {
        type: 'object',
        properties: {
          min_elevation: { type: 'number', description: '最低海拔（米），例如 4000；省略表示不限' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_view',
      description: '获取当前相机位置的经纬度、高度、朝向，以及视野对应的地理范围。',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_month',
      description: '设置季风气候实验室的月份时间轴（1-12），用于演示季风、雨带的季节变化。',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'number', description: '月份，1 到 12' }
        },
        required: ['month']
      }
    }
  }
]

const SYSTEM_PROMPT = [
  '你是 GuEarth 的地理教学助手，运行在一个三维数字地球桌面应用内。',
  '用户是地理课堂的师生。你的任务：理解用户需求，用工具驱动地球来回应。',
  '当用户想看某个地方时，先用 search_places 找到坐标，再用 fly_to 飞过去；',
  '当用户想找山峰、火山或按地形特征选点时，先让用户把视野缩放到目标区域，再用 find_peaks；',
  '当话题涉及季节变化（季风、雨带、气候）时，用 set_month 切换月份演示。',
  '回答用简体中文，简明、面向教学，主动补充与地形/气候相关的地理知识点。',
  '数值（坐标、海拔）保持精确。无法完成的请求要给出明确解释。'
].join('\n')

const CHAT_TIMEOUT_MS = 180000

const activeControllers = new Map<string, AbortController>()

function chunkPayload(requestId: string, payload: Record<string, unknown>): Record<string, unknown> {
  return { requestId, ...payload }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeEndpoint(rawBaseUrl: string): string {
  const trimmed = rawBaseUrl.trim().replace(/\/+$/, '')
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) throw new Error('AI 服务地址必须以 http(s) 开头')
  if (trimmed.endsWith('/chat/completions')) return trimmed
  return `${trimmed}/chat/completions`
}

function sanitizeMessages(rawMessages: unknown): AiChatMessage[] {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0 || rawMessages.length > 80) throw new Error('无效的对话消息')
  return rawMessages.map((raw) => {
    if (!isRecord(raw)) throw new Error('无效的对话消息')
    const role = raw.role
    if (role !== 'system' && role !== 'user' && role !== 'assistant' && role !== 'tool') throw new Error('无效的对话消息')
    if (typeof raw.content !== 'string' || raw.content.length > 32000) throw new Error('无效的对话内容')
    const message: AiChatMessage = { role, content: raw.content }
    if (typeof raw.toolCallId === 'string') message.toolCallId = raw.toolCallId
    if (Array.isArray(raw.toolCalls)) {
      message.toolCalls = raw.toolCalls.slice(0, 8).map((rawCall) => {
        if (!isRecord(rawCall) || typeof rawCall.name !== 'string' || typeof rawCall.args !== 'string') throw new Error('无效的工具调用')
        return { id: typeof rawCall.id === 'string' ? rawCall.id : '', name: rawCall.name, args: rawCall.args }
      })
    }
    return message
  })
}

function toApiMessages(messages: AiChatMessage[]): unknown[] {
  return messages.map((message) => {
    if (message.role === 'assistant' && message.toolCalls?.length) {
      return {
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id || `${call.name}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'function',
          function: { name: call.name, arguments: call.args }
        }))
      }
    }
    if (message.role === 'tool') {
      return { role: 'tool', content: message.content, tool_call_id: message.toolCallId || 'unknown' }
    }
    return { role: message.role, content: message.content }
  })
}

export function registerAiIpc(adapter: AiConfigAdapter): void {
  ipcMain.handle('ai:get-config', () => ({
    configured: Boolean(adapter.getApiKey()) && Boolean(adapter.getBaseUrl()),
    baseUrl: adapter.getBaseUrl(),
    model: adapter.getModel()
  }))

  ipcMain.handle('ai:save-config', (_event, patch: unknown) => {
    if (!isRecord(patch)) throw new Error('无效的 AI 配置')
    if (patch.baseUrl !== undefined) {
      if (typeof patch.baseUrl !== 'string' || (patch.baseUrl !== '' && !/^https?:\/\/[^\s]+$/i.test(patch.baseUrl.trim()))) {
        throw new Error('AI 服务地址格式无效')
      }
    }
    if (patch.model !== undefined) {
      if (typeof patch.model !== 'string' || patch.model.length > 120) throw new Error('模型名称无效')
    }
    if (patch.apiKey !== undefined) {
      if (typeof patch.apiKey !== 'string' || patch.apiKey.length > 4096) throw new Error('AI 密钥无效')
      if (patch.apiKey === '') adapter.clearApiKey()
      else {
        if (!safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储不可用')
        adapter.setApiKey(patch.apiKey)
      }
    }
    return {
      configured: Boolean(adapter.getApiKey()) && Boolean(adapter.getBaseUrl()),
      baseUrl: adapter.getBaseUrl(),
      model: adapter.getModel()
    }
  })

  ipcMain.handle('ai:chat', async (event, rawRequestId: unknown, rawMessages: unknown) => {
    if (typeof rawRequestId !== 'string' || !rawRequestId) throw new Error('无效的请求标识')
    const requestId = rawRequestId
    const sender = event.sender
    const send = (payload: Record<string, unknown>): void => {
      if (!sender.isDestroyed()) sender.send('ai:chunk', chunkPayload(requestId, payload))
    }
    const baseUrl = adapter.getBaseUrl()
    const apiKey = adapter.getApiKey()
    if (!baseUrl || !apiKey) {
      send({ type: 'error', message: '未配置 AI 服务，请在助手设置中填写服务地址与密钥' })
      return
    }
    let endpoint: string
    let messages: AiChatMessage[]
    try {
      endpoint = normalizeEndpoint(baseUrl)
      messages = sanitizeMessages(rawMessages)
    } catch (error) {
      send({ type: 'error', message: error instanceof Error ? error.message : '请求参数无效' })
      return
    }
    const controller = new AbortController()
    activeControllers.set(requestId, controller)
    const timeout = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: adapter.getModel(), messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...toApiMessages(messages)], tools: AI_TOOLS, stream: true }),
        signal: controller.signal
      })
      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => '')
        send({ type: 'error', message: `AI 服务响应异常 (${response.status}) ${detail.slice(0, 200)}` })
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let text = ''
      const toolAccumulator = new Map<number, { id: string; name: string; args: string }>()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as Record<string, unknown>
            const choice = Array.isArray(parsed.choices) ? (parsed.choices[0] as Record<string, unknown> | undefined) : undefined
            const delta = isRecord(choice) && isRecord(choice.delta) ? choice.delta : {}
            if (typeof delta.content === 'string' && delta.content) {
              text += delta.content
              send({ type: 'text', value: delta.content })
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const rawCall of delta.tool_calls) {
                if (!isRecord(rawCall)) continue
                const index = typeof rawCall.index === 'number' ? rawCall.index : toolAccumulator.size
                const entry = toolAccumulator.get(index) ?? { id: '', name: '', args: '' }
                if (typeof rawCall.id === 'string' && rawCall.id) entry.id = rawCall.id
                if (isRecord(rawCall.function)) {
                  if (typeof rawCall.function.name === 'string' && rawCall.function.name) entry.name = rawCall.function.name
                  if (typeof rawCall.function.arguments === 'string') entry.args += rawCall.function.arguments
                }
                toolAccumulator.set(index, entry)
              }
            }
          } catch {
            continue
          }
        }
      }
      const toolCalls = [...toolAccumulator.values()].filter((call) => call.name)
      send({ type: 'end', content: text, toolCalls })
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError'
      send({ type: 'error', message: aborted ? '请求已取消或超时' : `AI 请求失败：${error instanceof Error ? error.message : '未知错误'}` })
    } finally {
      clearTimeout(timeout)
      activeControllers.delete(requestId)
    }
  })

  ipcMain.handle('ai:abort', (_event, requestId: unknown) => {
    if (typeof requestId === 'string') activeControllers.get(requestId)?.abort()
  })
}
