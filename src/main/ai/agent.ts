import { ipcMain, net, type IpcMainInvokeEvent, type WebContents } from 'electron'
import type {
  AiChatEvent,
  AiChatTurn,
  AiModelConfig,
  AiProviderConfig,
  AiToolDefinition
} from '../../preload'
import { readProviderKey } from '../keyVault'
import { searchPlaces } from './amap'
import type { AiSettingsStore } from './settingsStore'

const SYSTEM_PROMPT = [
  '你是 GuEarth 数字地球上的地理教学助手 EOQ，面向中学与高校地理教学场景。',
  '回答使用简体中文，术语准确、条理清晰，讲解成因时给出可观察的证据。',
  '工具使用规则：',
  '- 用户询问某地在哪、想看某个地点时：先调用 search_place 查询地名坐标（支持模糊查询，返回坐标已转换为 WGS-84），再用返回的经纬度调用 fly_to 飞往该地；可以一次展示多个地点。',
  '- 用户询问地貌类型（流水侵蚀、风蚀、冰川、喀斯特等）时：先讲解典型地貌特征与成因，给出 2-4 个典型案例地点，用 search_place 查询后逐个 fly_to 展示，可用 query_terrain 查询海拔辅助讲解。',
  '- fly_to 的 height 为视点高度（米）：大区域全景 300000-1500000，城市 30000-80000，地貌细节 8000-30000，山峰可更低。',
  '- search_place 只对中国境内地名效果好；境外地点可直接使用你自己的地理知识给出 WGS-84 坐标并 fly_to。',
  '- 用户想找山峰、火山或按地形选点时：请用户先把视野缩放到目标区域，再用 find_peaks 检索，把结果中的典型山峰逐个 fly_to 展示。',
  '- 话题涉及季节变化（季风、气压带风带、雨带）时：用 set_month 切换到对应月份演示；解释气候成因或比较两地气候时：先对相关地点调用 explain_climate 获取气候区、纬度带与海拔背景，再结合海陆位置、大气环流、地形与洋流解释成因。',
  '- 话题涉及资源配置（南水北调、西气东输、西电东送）、能源安全、粮食基地、核电站、水电站、资源型城市、台风路径或经纬网定位时：调用 open_layer 打开对应教学图层并自动飞往展示，再结合图层内容讲解；不需要时可用 visible=false 关闭。',
  '- 需要在地图上标注地点时：add_marker 添加命名标记点（返回 id）；draw_shape 绘制线或多边形，省略 name 时自动标注长度或面积，适合测距、测面、展示边界与路线。',
  '- 添加标记或绘图后，用 fly_to 飞往该处向用户展示；讲解时可引用工具返回的 measurement 数值。',
  '- 用户要删除标记或图形时：先用 list_shapes 查看现有标注（含 id 与名称），再调用 remove_shape 按 id 或名称删除。',
  '- 用户让你看当前画面（“看看这里”“这是不是某种地貌”“我在看哪里”）时：先调用 capture_view 获取当前视角截图与地理范围，再结合画面、地形与地理知识判断；截图以图片形式提供，若当前模型不支持图像输入，则依据返回的 camera 与 extent 文本作答。',
  '- 工具返回 error 字段时，向用户说明原因（例如需要在图层面板配置高德密钥），不要编造坐标。',
  '不要在回答中输出 markdown 标题或表格，使用简洁的分段与短列表。'
].join('\n')

const SEARCH_PLACE_TOOL: AiToolDefinition = {
  name: 'search_place',
  description: '按名称搜索中国境内地点（城市、山川、景区、地标等），返回 WGS-84 经纬度与行政区划。适用于"XX在哪"、"带我看XX"类请求。',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '地点名称或关键词，支持模糊查询' },
      city: { type: 'string', description: '可选，限定搜索的城市名称，用于消歧' }
    },
    required: ['query']
  }
}

interface WireToolCall {
  id: string
  name: string
  arguments: string
}

interface ThinkingBlock {
  thinking: string
  signature: string
}

interface WireMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: WireToolCall[]
  thinkingBlocks?: ThinkingBlock[]
  callId?: string
  name?: string
  isError?: boolean
  image?: ToolImage
}

interface ToolImage {
  data: string
  mediaType: string
}

interface ToolOutcome {
  ok: boolean
  content: string
  image?: ToolImage
}

interface AgentSession {
  controller: AbortController
  sender: WebContents
}

const MAX_TOOL_ROUNDS = 8
const TOOL_RESULT_LIMIT = 24_000
const RENDERER_TOOL_TIMEOUT_MS = 60_000

const sessions = new Map<string, AgentSession>()
const pendingRendererTools = new Map<string, { resolve: (outcome: ToolOutcome) => void; timer: NodeJS.Timeout }>()

function safeParseJson(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text || '{}')
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function clampToolResult(value: string): string {
  if (value.length <= TOOL_RESULT_LIMIT) return value
  return `${value.slice(0, TOOL_RESULT_LIMIT / 2)}\n…(结果过长已截断)…\n${value.slice(-TOOL_RESULT_LIMIT / 2)}`
}

function extractImage(value: unknown): ToolImage | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const image = (value as Record<string, unknown>).image
  if (typeof image !== 'string') return undefined
  const match = /^data:([^;]+);base64,(.+)$/.exec(image)
  return match ? { mediaType: match[1], data: match[2] } : undefined
}

function withoutImage(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const { image, ...rest } = value as Record<string, unknown>
  return image === undefined ? value : rest
}

function imageUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /image|vision|multimodal|modal|unsupported|不支持|图片/i.test(message)
}

function stringifyArgSummary(args: unknown): string {
  if (typeof args !== 'object' || args === null) return ''
  const entries = Object.entries(args as Record<string, unknown>).filter(([, value]) => value !== undefined)
  return entries.map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`).join(' ')
}

function estimateTokens(text: string): number {
  let cjk = 0
  for (const char of text) if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) cjk += 1
  return cjk + Math.ceil((text.length - cjk) / 3.5)
}

function trimHistory(messages: WireMessage[], contextWindow: number): WireMessage[] {
  const budget = Math.max(2_000, Math.floor(contextWindow * 0.6))
  const system = messages.filter((message) => message.role === 'system')
  const rest = messages.filter((message) => message.role !== 'system')
  let total = system.reduce((sum, message) => sum + estimateTokens(message.content), 0)
  const kept: WireMessage[] = []
  for (let index = rest.length - 1; index >= 0; index -= 1) {
    const message = rest[index]
    const cost = estimateTokens(message.content) + (message.toolCalls ?? []).reduce((sum, call) => sum + estimateTokens(call.arguments), 0)
    if (kept.length >= 4 && total + cost > budget) break
    kept.unshift(message)
    total += cost
  }
  return [...system, ...kept]
}

function apiEndpoint(baseUrl: string, protocol: AiProviderConfig['protocol'], path: string): string {
  let base = baseUrl.trim().replace(/\/+$/, '')
  if (/^https?:\/\/[^/]+$/i.test(base)) base = `${base}/v1`
  return `${base}${path}`
}

function openaiThinkingBody(model: AiModelConfig, baseUrl: string): Record<string, unknown> {
  if (!model.thinking) return {}
  if (/dashscope|qwen/i.test(baseUrl)) return { enable_thinking: true }
  return { reasoning_effort: model.thinkingLevel }
}

const anthropicBudget: Record<string, number> = { low: 1_024, medium: 4_096, high: 16_384 }

function toOpenAiMessages(messages: WireMessage[]): unknown[] {
  return messages.map((message) => {
    if (message.role === 'system') return { role: 'system', content: message.content }
    if (message.role === 'user') return { role: 'user', content: message.content }
    if (message.role === 'assistant') {
      const entry: Record<string, unknown> = { role: 'assistant', content: message.content || '' }
      if (message.toolCalls?.length) {
        entry.tool_calls = message.toolCalls.map((call) => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments || '{}' } }))
      }
      return entry
    }
    return {
      role: 'tool',
      tool_call_id: message.callId,
      content: message.image
        ? [
            { type: 'text', text: message.content },
            { type: 'image_url', image_url: { url: `data:${message.image.mediaType};base64,${message.image.data}` } }
          ]
        : message.content
    }
  })
}

function toAnthropicMessages(messages: WireMessage[]): unknown[] {
  const result: { role: string; content: unknown }[] = []
  for (const message of messages) {
    if (message.role === 'system') continue
    if (message.role === 'user') {
      result.push({ role: 'user', content: message.content })
      continue
    }
    if (message.role === 'assistant') {
      const blocks: Record<string, unknown>[] = [
        ...(message.thinkingBlocks ?? []).map((block) => ({ type: 'thinking', thinking: block.thinking, signature: block.signature }))
      ]
      if (message.content) blocks.push({ type: 'text', text: message.content })
      for (const call of message.toolCalls ?? []) blocks.push({ type: 'tool_use', id: call.id, name: call.name, input: safeParseJson(call.arguments) })
      result.push({ role: 'assistant', content: blocks.length ? blocks : [{ type: 'text', text: '' }] })
      continue
    }
    const content = message.image
      ? [
          { type: 'text', text: message.content },
          { type: 'image', source: { type: 'base64', media_type: message.image.mediaType, data: message.image.data } }
        ]
      : message.content
    const block = { type: 'tool_result', tool_use_id: message.callId, content, is_error: message.isError === true }
    const last = result[result.length - 1]
    if (last && last.role === 'user' && Array.isArray(last.content)) last.content.push(block)
    else result.push({ role: 'user', content: [block] })
  }
  return result
}

async function readSse(response: Response, onEvent: (data: string) => void): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('响应缺少数据流')
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, '')
      buffer = buffer.slice(newlineIndex + 1)
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim()
        if (data) onEvent(data)
      }
      newlineIndex = buffer.indexOf('\n')
    }
  }
}

interface RequestResult {
  text: string
  reasoning: string
  thinkingBlocks: ThinkingBlock[]
  toolCalls: WireToolCall[]
}

async function fetchJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await net.fetch(url, init)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`请求失败 ${response.status}：${body.slice(0, 400) || response.statusText}`)
  }
  const parsed: unknown = await response.json()
  if (typeof parsed !== 'object' || parsed === null) throw new Error('响应格式错误')
  return parsed as Record<string, unknown>
}

function collectOpenAiToolCalls(raw: unknown): WireToolCall[] {
  if (!Array.isArray(raw)) return []
  const byIndex = new Map<number, { id: string; name: string; args: string }>()
  for (const fragment of raw) {
    if (typeof fragment !== 'object' || fragment === null) continue
    const piece = fragment as { index?: unknown; id?: unknown; function?: { name?: unknown; arguments?: unknown } }
    const index = typeof piece.index === 'number' ? piece.index : 0
    const current = byIndex.get(index) ?? { id: '', name: '', args: '' }
    if (typeof piece.id === 'string' && piece.id) current.id = piece.id
    if (piece.function) {
      if (typeof piece.function.name === 'string' && piece.function.name && !current.name) current.name = piece.function.name
      if (typeof piece.function.arguments === 'string') current.args += piece.function.arguments
    }
    byIndex.set(index, current)
  }
  return [...byIndex.entries()].map(([index, call]) => ({ id: call.id || `call_${index}`, name: call.name, arguments: call.args || '{}' })).filter((call) => call.name)
}

async function runOpenAiTurn(options: {
  provider: AiProviderConfig
  model: AiModelConfig
  apiKey: string
  messages: WireMessage[]
  tools: AiToolDefinition[]
  signal: AbortSignal
  onTextDelta: (text: string) => void
  onReasoningDelta: (text: string) => void
}): Promise<RequestResult> {
  const { provider, model, apiKey, messages, tools, signal, onTextDelta, onReasoningDelta } = options
  const url = apiEndpoint(provider.baseUrl, provider.protocol, '/chat/completions')
  const body: Record<string, unknown> = {
    model: model.id,
    messages: toOpenAiMessages(messages),
    ...openaiThinkingBody(model, provider.baseUrl)
  }
  if (tools.length) {
    body.tools = tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } }))
    body.tool_choice = 'auto'
  }
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
  if (!model.streaming) {
    const json = await fetchJson(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
    const choice = Array.isArray(json.choices) && json.choices[0] && typeof json.choices[0] === 'object' ? json.choices[0] as Record<string, unknown> : {}
    const message = typeof choice.message === 'object' && choice.message !== null ? choice.message as Record<string, unknown> : {}
    const reasoning = typeof message.reasoning_content === 'string' ? message.reasoning_content : ''
    if (reasoning) onReasoningDelta(reasoning)
    return {
      text: typeof message.content === 'string' ? message.content : '',
      reasoning,
      thinkingBlocks: [],
      toolCalls: collectOpenAiToolCalls(message.tool_calls)
    }
  }
  body.stream = true
  const response = await net.fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`请求失败 ${response.status}：${errorBody.slice(0, 400) || response.statusText}`)
  }
  let text = ''
  let reasoning = ''
  const toolAccumulator = new Map<number, { id: string; name: string; args: string }>()
  await readSse(response, (data) => {
    if (data === '[DONE]') return
    const json = safeParseJson(data)
    const choices = json.choices
    if (!Array.isArray(choices) || !choices.length) return
    const delta = (typeof choices[0] === 'object' && choices[0] !== null ? (choices[0] as Record<string, unknown>).delta : null) as Record<string, unknown> | null
    if (!delta) return
    if (typeof delta.content === 'string' && delta.content) {
      text += delta.content
      onTextDelta(delta.content)
    }
    const reasoningDelta = typeof delta.reasoning_content === 'string' ? delta.reasoning_content : typeof delta.reasoning === 'string' ? delta.reasoning : ''
    if (reasoningDelta) {
      reasoning += reasoningDelta
      onReasoningDelta(reasoningDelta)
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const fragment of delta.tool_calls) {
        if (typeof fragment !== 'object' || fragment === null) continue
        const piece = fragment as { index?: unknown; id?: unknown; function?: { name?: unknown; arguments?: unknown } }
        const index = typeof piece.index === 'number' ? piece.index : 0
        const current = toolAccumulator.get(index) ?? { id: '', name: '', args: '' }
        if (typeof piece.id === 'string' && piece.id) current.id = piece.id
        if (piece.function) {
          if (typeof piece.function.name === 'string' && piece.function.name && !current.name) current.name = piece.function.name
          if (typeof piece.function.arguments === 'string') current.args += piece.function.arguments
        }
        toolAccumulator.set(index, current)
      }
    }
  })
  const toolCalls = [...toolAccumulator.entries()].map(([index, call]) => ({ id: call.id || `call_${index}`, name: call.name, arguments: call.args || '{}' })).filter((call) => call.name)
  return { text, reasoning, thinkingBlocks: [], toolCalls }
}

async function runAnthropicTurn(options: {
  provider: AiProviderConfig
  model: AiModelConfig
  apiKey: string
  messages: WireMessage[]
  tools: AiToolDefinition[]
  signal: AbortSignal
  onTextDelta: (text: string) => void
  onReasoningDelta: (text: string) => void
}): Promise<RequestResult> {
  const { provider, model, apiKey, messages, tools, signal, onTextDelta, onReasoningDelta } = options
  const url = apiEndpoint(provider.baseUrl, provider.protocol, '/messages')
  const budgetTokens = anthropicBudget[model.thinkingLevel] ?? anthropicBudget.medium
  const maxTokens = model.thinking ? Math.max(8_192, budgetTokens * 2) : 8_192
  const body: Record<string, unknown> = {
    model: model.id,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    messages: toAnthropicMessages(messages)
  }
  if (model.thinking) body.thinking = { type: 'enabled', budget_tokens: budgetTokens }
  if (tools.length) body.tools = tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters }))
  const headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
  if (!model.streaming) {
    const json = await fetchJson(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
    const blocks = Array.isArray(json.content) ? json.content.filter((block): block is Record<string, unknown> => typeof block === 'object' && block !== null) : []
    const text = blocks.filter((block) => block.type === 'text').map((block) => String(block.text ?? '')).join('')
    const thinkingBlocks = blocks.filter((block) => block.type === 'thinking').map((block) => ({ thinking: String(block.thinking ?? ''), signature: String(block.signature ?? '') }))
    const reasoning = thinkingBlocks.map((block) => block.thinking).join('')
    if (reasoning) onReasoningDelta(reasoning)
    if (text) onTextDelta(text)
    return {
      text,
      reasoning,
      thinkingBlocks,
      toolCalls: blocks.filter((block) => block.type === 'tool_use').map((block, position) => ({ id: String(block.id ?? `call_${position}`), name: String(block.name ?? ''), arguments: JSON.stringify(block.input ?? {}) }))
    }
  }
  body.stream = true
  const response = await net.fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`请求失败 ${response.status}：${errorBody.slice(0, 400) || response.statusText}`)
  }
  let text = ''
  const thinkingBlocks: ThinkingBlock[] = []
  const toolCalls: WireToolCall[] = []
  const blockTypes = new Map<number, { type: string; id: string; name: string; args: string; thinking: string; signature: string }>()
  await readSse(response, (data) => {
    const json = safeParseJson(data)
    const type = json.type
    if (type === 'content_block_start') {
      const index = Number(json.index ?? 0)
      const block = typeof json.content_block === 'object' && json.content_block !== null ? json.content_block as Record<string, unknown> : {}
      blockTypes.set(index, { type: String(block.type ?? 'text'), id: String(block.id ?? ''), name: String(block.name ?? ''), args: '', thinking: '', signature: '' })
      return
    }
    if (type === 'content_block_delta') {
      const index = Number(json.index ?? 0)
      const block = blockTypes.get(index)
      const delta = typeof json.delta === 'object' && json.delta !== null ? json.delta as Record<string, unknown> : {}
      if (!block) return
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        text += delta.text
        onTextDelta(delta.text)
      } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
        block.thinking += delta.thinking
        onReasoningDelta(delta.thinking)
      } else if (delta.type === 'signature_delta' && typeof delta.signature === 'string') {
        block.signature += delta.signature
      } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
        block.args += delta.partial_json
      }
      return
    }
    if (type === 'content_block_stop') {
      const index = Number(json.index ?? 0)
      const block = blockTypes.get(index)
      if (!block) return
      if (block.type === 'thinking' && block.thinking) thinkingBlocks.push({ thinking: block.thinking, signature: block.signature })
      if (block.type === 'tool_use' && block.name) toolCalls.push({ id: block.id || `call_${index}`, name: block.name, arguments: block.args || '{}' })
    }
  })
  const reasoning = thinkingBlocks.map((block) => block.thinking).join('')
  return { text, reasoning, thinkingBlocks, toolCalls }
}

function emit(sender: WebContents, event: AiChatEvent): void {
  if (sender.isDestroyed()) return
  sender.send('ai:event', event)
}

async function dispatchRendererTool(sender: WebContents, sessionId: string, callId: string, name: string, args: unknown): Promise<ToolOutcome> {
  return new Promise<ToolOutcome>((resolve) => {
    const timer = setTimeout(() => {
      pendingRendererTools.delete(callId)
      resolve({ ok: false, content: JSON.stringify({ error: `工具 ${name} 执行超时` }) })
    }, RENDERER_TOOL_TIMEOUT_MS)
    pendingRendererTools.set(callId, { resolve, timer })
    emit(sender, { sessionId, type: 'execute-tool', callId, name, args })
  })
}

async function executeTool(sender: WebContents, sessionId: string, name: string, argsJson: string): Promise<ToolOutcome & { callId: string; summary: string }> {
  const args = safeParseJson(argsJson)
  const callId = `${name}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
  emit(sender, { sessionId, type: 'tool-start', callId, name, args })
  let outcome: ToolOutcome
  try {
    if (name === 'search_place') {
      const query = typeof args.query === 'string' ? args.query : ''
      const city = typeof args.city === 'string' ? args.city : undefined
      const result = await searchPlaces(query, city)
      outcome = { ok: !result.error, content: clampToolResult(JSON.stringify(result)) }
    } else {
      outcome = await dispatchRendererTool(sender, sessionId, callId, name, args)
    }
  } catch (error) {
    outcome = { ok: false, content: JSON.stringify({ error: error instanceof Error ? error.message : '工具执行失败' }) }
  }
  return { ...outcome, callId, summary: summarizeToolResult(outcome.content) }
}

async function runAgent(options: {
  provider: AiProviderConfig
  model: AiModelConfig
  apiKey: string
  sender: WebContents
  sessionId: string
  signal: AbortSignal
  turns: AiChatTurn[]
  tools: AiToolDefinition[]
}): Promise<void> {
  const { provider, model, apiKey, sender, sessionId, signal, turns, tools } = options
  const send = (event: AiChatEvent) => emit(sender, event)
  const messages: WireMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
  for (const turn of turns) {
    if (turn.content.trim()) messages.push({ role: turn.role, content: turn.content })
  }
  const toolset: AiToolDefinition[] = [...tools.filter((tool) => tool.name !== 'search_place'), SEARCH_PLACE_TOOL]
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    let requestMessages = trimHistory(messages, model.contextWindow)
    const runTurn = provider.protocol === 'anthropic' ? runAnthropicTurn : runOpenAiTurn
    let result: RequestResult
    try {
      result = await runTurn({
        provider,
        model,
        apiKey,
        messages: requestMessages,
        tools: toolset,
        signal,
        onTextDelta: (text) => send({ sessionId, type: 'text-delta', text }),
        onReasoningDelta: (text) => send({ sessionId, type: 'reasoning-delta', text })
      })
    } catch (error) {
      if (signal.aborted || !requestMessages.some((message) => message.image) || !imageUnsupported(error)) throw error
      requestMessages = requestMessages.map((message) => (message.image ? { ...message, image: undefined } : message))
      result = await runTurn({
        provider,
        model,
        apiKey,
        messages: requestMessages,
        tools: toolset,
        signal,
        onTextDelta: (text) => send({ sessionId, type: 'text-delta', text }),
        onReasoningDelta: (text) => send({ sessionId, type: 'reasoning-delta', text })
      })
    }
    if (!result.toolCalls.length) {
      messages.push({ role: 'assistant', content: result.text })
      send({ sessionId, type: 'done' })
      return
    }
    messages.push({ role: 'assistant', content: result.text, toolCalls: result.toolCalls, thinkingBlocks: result.thinkingBlocks })
    for (const call of result.toolCalls) {
      const outcome = await executeTool(sender, sessionId, call.name, call.arguments)
      send({ sessionId, type: 'tool-end', callId: outcome.callId, ok: outcome.ok, summary: outcome.summary, result: outcome.content })
      messages.push({ role: 'tool', content: outcome.content, callId: call.id, name: call.name, isError: !outcome.ok, image: outcome.image })
    }
  }
  send({ sessionId, type: 'error', message: '工具调用轮次过多，已停止' })
}

function summarizeToolResult(content: string): string {
  const parsed = safeParseJson(content)
  if (typeof parsed.error === 'string') return parsed.error.slice(0, 60)
  if (Array.isArray(parsed.places)) return `${parsed.places.length} 个地点`
  if (parsed.screenshot) return '已截图'
  if (Array.isArray(parsed.shapes)) return `${parsed.shapes.length} 个标注`
  if (typeof parsed.removed === 'number') return `已删除 ${parsed.removed} 个标注`
  if (typeof parsed.name === 'string' && parsed.name) return parsed.kind === 'point' ? `已添加标记「${parsed.name}」` : `已绘制「${parsed.name}」`
  if (typeof parsed.measurement === 'string' && parsed.measurement) return parsed.measurement
  if (typeof parsed.height === 'number') return `海拔 ${Math.round(parsed.height)} m`
  if (typeof parsed.longitude === 'number') return '已定位'
  return '完成'
}

function validateChatRequest(sessionId: unknown, turns: unknown, tools: unknown): { sessionId: string; turns: AiChatTurn[]; tools: AiToolDefinition[] } {
  if (typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId)) throw new Error('无效的会话标识')
  if (!Array.isArray(turns)) throw new Error('无效的对话历史')
  const normalizedTurns = turns.flatMap((turn): AiChatTurn[] => {
    if (typeof turn !== 'object' || turn === null) return []
    const record = turn as { role?: unknown; content?: unknown }
    if ((record.role !== 'user' && record.role !== 'assistant') || typeof record.content !== 'string') return []
    return [{ role: record.role, content: record.content.slice(0, 20_000) }]
  })
  const normalizedTools = Array.isArray(tools) ? tools.flatMap((tool): AiToolDefinition[] => {
    if (typeof tool !== 'object' || tool === null) return []
    const record = tool as { name?: unknown; description?: unknown; parameters?: unknown }
    if (typeof record.name !== 'string' || !/^[a-z0-9_]{1,64}$/i.test(record.name) || typeof record.description !== 'string') return []
    return [{ name: record.name, description: record.description.slice(0, 2_000), parameters: typeof record.parameters === 'object' && record.parameters !== null ? record.parameters as Record<string, unknown> : { type: 'object', properties: {} } }]
  }) : []
  return { sessionId, turns: normalizedTurns, tools: normalizedTools }
}

export function registerAiIpcHandlers(settingsStore: AiSettingsStore): void {
  ipcMain.handle('ai:get-settings', () => settingsStore.snapshot())
  ipcMain.handle('ai:update-settings', (_event, value: unknown) => settingsStore.update(value))
  ipcMain.handle('ai:chat', (event: IpcMainInvokeEvent, sessionId: unknown, turns: unknown, tools: unknown) => {
    const request = validateChatRequest(sessionId, turns, tools)
    const settings = settingsStore.snapshot()
    const provider = settings.providers.find((item) => item.id === settings.activeProviderId)
    const model = provider?.models.find((item) => item.id === settings.activeModelId)
    if (!provider || !model) throw new Error('未选择 AI 模型，请先在 AI 设置中添加供应商与模型并设为默认')
    const apiKey = readProviderKey(`ai-${provider.id}`)
    if (!apiKey) throw new Error(`未配置「${provider.name}」的 API Key，请在 AI 设置中保存`)
    const existing = sessions.get(request.sessionId)
    existing?.controller.abort()
    const controller = new AbortController()
    sessions.set(request.sessionId, { controller, sender: event.sender })
    const sender = event.sender
    void runAgent({ provider, model, apiKey, sender, sessionId: request.sessionId, signal: controller.signal, turns: request.turns, tools: request.tools })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          emit(sender, { sessionId: request.sessionId, type: 'error', message: '已停止生成' })
          return
        }
        if (signalAborted(controller, error)) {
          emit(sender, { sessionId: request.sessionId, type: 'error', message: '已停止生成' })
          return
        }
        emit(sender, { sessionId: request.sessionId, type: 'error', message: error instanceof Error ? error.message : 'AI 请求失败' })
      })
      .finally(() => {
        if (sessions.get(request.sessionId)?.sender === sender) sessions.delete(request.sessionId)
      })
  })
  ipcMain.handle('ai:stop', (_event, sessionId: unknown) => {
    if (typeof sessionId !== 'string') return
    sessions.get(sessionId)?.controller.abort()
  })
  ipcMain.handle('ai:tool-result', (_event, sessionId: unknown, callId: unknown, ok: unknown, result: unknown) => {
    if (typeof sessionId !== 'string' || typeof callId !== 'string') return
    const entry = pendingRendererTools.get(callId)
    if (!entry) return
    clearTimeout(entry.timer)
    pendingRendererTools.delete(callId)
    const image = extractImage(result)
    const payload = clampToolResult(typeof result === 'string' ? result : JSON.stringify(withoutImage(result) ?? {}) ?? '{}')
    entry.resolve({ ok: ok === true, content: payload || '{}', image })
  })
}

function signalAborted(controller: AbortController, error: unknown): boolean {
  if (controller.signal.aborted) return true
  return error instanceof Error && /abort/i.test(error.message)
}
