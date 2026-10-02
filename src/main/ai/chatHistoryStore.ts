import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import type { AiSearchReference, StoredAiConversation, StoredAiMessage, StoredAiPart, StoredAiToolStep } from '../../preload'

const MAX_CONVERSATIONS = 50
const MAX_MESSAGES = 400
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clampString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function clampTimestamp(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
}

function normalizeReferences(value: unknown): AiSearchReference[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): AiSearchReference[] => {
    if (!isRecord(item)) return []
    const title = clampString(item.title, 300)
    const url = clampString(item.url, 2000)
    if (!title && !url) return []
    return [{
      title,
      url,
      content: clampString(item.content, 1000),
      website: clampString(item.website, 200),
      date: clampString(item.date, 40)
    }]
  }).slice(0, 16)
}

function normalizeToolStep(value: unknown): StoredAiToolStep | null {
  if (!isRecord(value)) return null
  const callId = clampString(value.callId, 128)
  const name = clampString(value.name, 64)
  if (!callId || !name) return null
  const status: StoredAiToolStep['status'] = value.status === 'error' ? 'error' : 'ok'
  return {
    callId,
    name,
    args: isRecord(value.args) ? value.args : {},
    status,
    summary: clampString(value.summary, 400),
    result: clampString(value.result, 10_000),
    references: normalizeReferences(value.references)
  }
}

function normalizePart(value: unknown): StoredAiPart | null {
  if (!isRecord(value)) return null
  if (value.kind === 'reasoning') {
    const id = clampString(value.id, 128)
    if (!id) return null
    return { kind: 'reasoning', id, text: clampString(value.text, 100_000), ms: clampTimestamp(value.ms, 0), startedAt: clampTimestamp(value.startedAt, 0) }
  }
  if (value.kind === 'text') return { kind: 'text', text: clampString(value.text, 100_000) }
  if (value.kind === 'tool') {
    const step = normalizeToolStep(value.step)
    return step ? { kind: 'tool', step } : null
  }
  return null
}

function normalizeMessage(value: unknown): StoredAiMessage | null {
  if (!isRecord(value)) return null
  const id = clampString(value.id, 128)
  if (!id) return null
  const role = value.role === 'user' ? 'user' : value.role === 'assistant' ? 'assistant' : null
  if (!role) return null
  const parts = Array.isArray(value.parts)
    ? value.parts.map(normalizePart).filter((part): part is StoredAiPart => part !== null).slice(0, 200)
    : []
  return {
    id,
    role,
    content: clampString(value.content, 50_000),
    parts,
    status: value.status === 'error' ? 'error' : 'done',
    error: clampString(value.error, 1000)
  }
}

export function normalizeConversation(value: unknown): StoredAiConversation | null {
  if (!isRecord(value)) return null
  const id = clampString(value.id, 64)
  if (!ID_PATTERN.test(id)) return null
  const messages = Array.isArray(value.messages)
    ? value.messages.map(normalizeMessage).filter((message): message is StoredAiMessage => message !== null).slice(-MAX_MESSAGES)
    : []
  if (!messages.some((message) => message.role === 'user')) return null
  const updatedAt = clampTimestamp(value.updatedAt, Date.now())
  return {
    id,
    title: clampString(value.title, 80) || '未命名会话',
    createdAt: clampTimestamp(value.createdAt, updatedAt),
    updatedAt,
    messages
  }
}

export class AiChatHistoryStore {
  private path = ''
  private conversations: StoredAiConversation[] = []

  init(path: string): void {
    this.path = path
    this.conversations = this.read()
  }

  private read(): StoredAiConversation[] {
    if (!this.path || !existsSync(this.path)) return []
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path, 'utf8'))
      const list = Array.isArray(parsed) ? parsed.map(normalizeConversation) : []
      return this.dedupeSorted(list)
    } catch {
      return []
    }
  }

  private dedupeSorted(list: (StoredAiConversation | null)[]): StoredAiConversation[] {
    const seen = new Set<string>()
    const result: StoredAiConversation[] = []
    for (const conversation of list) {
      if (!conversation || seen.has(conversation.id)) continue
      seen.add(conversation.id)
      result.push(conversation)
    }
    return result.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS)
  }

  private persist(): void {
    if (!this.path) return
    const tempPath = `${this.path}.tmp`
    writeFileSync(tempPath, JSON.stringify(this.conversations, null, 2), 'utf8')
    renameSync(tempPath, this.path)
  }

  list(): StoredAiConversation[] {
    return this.conversations
  }

  save(value: unknown): StoredAiConversation[] {
    const conversation = normalizeConversation(value)
    if (!conversation) throw new Error('无效的会话数据')
    this.conversations = this.dedupeSorted([conversation, ...this.conversations.filter((item) => item.id !== conversation.id)])
    this.persist()
    return this.conversations
  }

  delete(id: string): StoredAiConversation[] {
    this.conversations = this.conversations.filter((item) => item.id !== id)
    this.persist()
    return this.conversations
  }
}
