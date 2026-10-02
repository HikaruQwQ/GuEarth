import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { AiChatEvent, AiSettings, AiToolDefinition } from '../../../preload'

export interface ToolStep {
  callId: string
  name: string
  args: Record<string, unknown>
  status: 'running' | 'ok' | 'error'
  summary: string
  result: string
}

export interface ReasoningPart {
  kind: 'reasoning'
  id: string
  text: string
  ms: number
  startedAt: number
}

export interface TextPart {
  kind: 'text'
  text: string
}

export interface ToolPart {
  kind: 'tool'
  step: ToolStep
}

export type AssistantPart = ReasoningPart | TextPart | ToolPart

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  parts: AssistantPart[]
  status: 'streaming' | 'done' | 'error'
  error: string
}

export interface RendererTool {
  definition: AiToolDefinition
  execute: (args: Record<string, unknown>) => Promise<unknown>
}

let eventListenerBound = false
let messageSeq = 0
let sessionSeq = 0
let activeSessionId = ''

const rendererTools = new Map<string, RendererTool>()

function stripIpcErrorPrefix(message: string): string {
  return message.replace(/^Error invoking remote method '[^']+':?\s*(Error:\s*)?/i, '')
}

function reportsFailure(result: unknown): boolean {
  if (typeof result !== 'object' || result === null) return false
  const error = (result as Record<string, unknown>).error
  return typeof error === 'string' && error !== ''
}

export const useAiStore = defineStore('ai', () => {
  const settings = ref<AiSettings>({ providers: [], activeProviderId: '', activeModelId: '' })
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const isPanelOpen = ref(false)
  const isSettingsOpen = ref(false)
  const hydrated = ref(false)

  function currentAssistant(): ChatMessage | undefined {
    for (let index = messages.value.length - 1; index >= 0; index -= 1) {
      const message = messages.value[index]
      if (message.role === 'assistant') return message
    }
    return undefined
  }

  function handleEvent(event: AiChatEvent): void {
    if (event.sessionId !== activeSessionId) return
    if (event.type === 'reasoning-delta' || event.type === 'text-delta') {
      const assistant = currentAssistant()
      if (!assistant || assistant.status !== 'streaming') return
      const last = assistant.parts[assistant.parts.length - 1]
      if (event.type === 'reasoning-delta') {
        let part = last && last.kind === 'reasoning' ? last : undefined
        if (!part) {
          part = { kind: 'reasoning', id: `${assistant.id}-r${assistant.parts.length}`, text: '', ms: 0, startedAt: Date.now() }
          assistant.parts.push(part)
        }
        part.text += event.text
        part.ms = Date.now() - part.startedAt
      } else if (last && last.kind === 'text') {
        assistant.content += event.text
        last.text += event.text
      } else {
        assistant.content += event.text
        assistant.parts.push({ kind: 'text', text: event.text })
      }
      return
    }
    if (event.type === 'tool-start') {
      const assistant = currentAssistant()
      if (!assistant || assistant.status !== 'streaming') return
      assistant.parts.push({ kind: 'tool', step: { callId: event.callId, name: event.name, args: (event.args ?? {}) as Record<string, unknown>, status: 'running', summary: '', result: '' } })
      return
    }
    if (event.type === 'tool-end') {
      const assistant = currentAssistant()
      const step = assistant?.parts.find((part): part is ToolPart => part.kind === 'tool' && part.step.callId === event.callId)?.step
      if (step) {
        step.status = event.ok ? 'ok' : 'error'
        step.summary = event.summary
        step.result = event.result
      }
      return
    }
    if (event.type === 'execute-tool') {
      void (async () => {
        const tool = rendererTools.get(event.name)
        if (!tool) {
          await window.guEarth.ai.toolResult(event.sessionId, event.callId, false, { error: `未知工具 ${event.name}` })
          return
        }
        try {
          const result = await tool.execute((event.args ?? {}) as Record<string, unknown>)
          await window.guEarth.ai.toolResult(event.sessionId, event.callId, !reportsFailure(result), result ?? { ok: true })
        } catch (error) {
          await window.guEarth.ai.toolResult(event.sessionId, event.callId, false, { error: error instanceof Error ? error.message : '工具执行失败' })
        }
      })()
      return
    }
    if (event.type === 'done') {
      const assistant = currentAssistant()
      if (assistant && assistant.status === 'streaming') assistant.status = 'done'
      isStreaming.value = false
      return
    }
    if (event.type === 'error') {
      const assistant = currentAssistant()
      if (assistant && assistant.status === 'streaming') {
        assistant.status = 'error'
        assistant.error = event.message
      }
      isStreaming.value = false
    }
  }

  function bindEventListener(): void {
    if (eventListenerBound || typeof window === 'undefined' || !window.guEarth?.ai) return
    eventListenerBound = true
    window.guEarth.ai.onEvent(handleEvent)
  }

  async function hydrate(): Promise<void> {
    bindEventListener()
    if (hydrated.value || !window.guEarth?.ai) return
    try {
      settings.value = await window.guEarth.ai.getSettings()
      hydrated.value = true
    } catch {
      settings.value = { providers: [], activeProviderId: '', activeModelId: '' }
    }
  }

  function registerTool(tool: RendererTool): void {
    rendererTools.set(tool.definition.name, tool)
  }

  function toolDefinitions(): AiToolDefinition[] {
    return [...rendererTools.values()].map((tool) => tool.definition)
  }

  async function saveSettings(next: AiSettings): Promise<void> {
    settings.value = await window.guEarth.ai.updateSettings(next)
  }

  function activeModelReady(): boolean {
    const provider = settings.value.providers.find((item) => item.id === settings.value.activeProviderId)
    return Boolean(provider?.models.some((model) => model.id === settings.value.activeModelId))
  }

  function activeModelVisionEnabled(): boolean {
    const provider = settings.value.providers.find((item) => item.id === settings.value.activeProviderId)
    return provider?.models.find((item) => item.id === settings.value.activeModelId)?.vision === true
  }

  async function send(text: string): Promise<void> {
    const question = text.trim()
    if (!question || isStreaming.value) return
    await hydrate()
    messageSeq += 1
    messages.value.push({ id: `m${messageSeq}`, role: 'user', content: question, parts: [], status: 'done', error: '' })
    messageSeq += 1
    messages.value.push({ id: `m${messageSeq}`, role: 'assistant', content: '', parts: [], status: 'streaming', error: '' })
    if (!activeModelReady()) {
      const assistant = currentAssistant()
      if (assistant) {
        assistant.status = 'error'
        assistant.error = '尚未配置 AI 模型：点击右上角设置，添加供应商与模型并保存 API Key'
      }
      return
    }
    sessionSeq += 1
    activeSessionId = `s${sessionSeq}`
    const sessionId = activeSessionId
    isStreaming.value = true
    const turns = messages.value
      .filter((message) => message.status !== 'streaming' && !message.error)
      .filter((message) => message.content.trim() !== '' || message.role === 'user')
      .map((message) => ({ role: message.role, content: message.content }))
    try {
      await window.guEarth.ai.chat(sessionId, turns, toolDefinitions())
    } catch (error) {
      const assistant = currentAssistant()
      if (assistant && assistant.status === 'streaming') {
        assistant.status = 'error'
        assistant.error = stripIpcErrorPrefix(error instanceof Error ? error.message : 'AI 请求失败')
      }
      isStreaming.value = false
    }
  }

  async function stop(): Promise<void> {
    if (!activeSessionId) return
    await window.guEarth.ai.stop(activeSessionId)
  }

  function clearConversation(): void {
    if (isStreaming.value) return
    messages.value = []
  }

  function setPanelOpen(value: boolean): void {
    isPanelOpen.value = value
    if (value) void hydrate()
  }

  function setSettingsOpen(value: boolean): void {
    isSettingsOpen.value = value
  }

  return {
    settings, messages, isStreaming, isPanelOpen, isSettingsOpen, hydrated,
    hydrate, registerTool, saveSettings, send, stop, clearConversation, setPanelOpen, setSettingsOpen,
    activeModelVisionEnabled
  }
})
