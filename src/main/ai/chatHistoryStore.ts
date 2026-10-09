import { copyFile, mkdir, readdir, unlink } from 'fs/promises'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { readJson, serialQueue, writeJson } from '../jsonStore'
import type { AiSearchReference, StoredAiCompression, StoredAiConversation, StoredAiConversationSummary, StoredAiMessage, StoredAiPart, StoredAiToolStep } from '../../preload'

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

function normalizeCompression(value: unknown): StoredAiCompression | undefined {
  if (!isRecord(value)) return undefined
  const summary = clampString(value.summary, 100_000)
  const coveredMessageIds = Array.isArray(value.coveredMessageIds)
    ? value.coveredMessageIds.filter((id): id is string => typeof id === 'string' && id.length > 0).map((id) => id.slice(0, 128)).slice(0, MAX_MESSAGES)
    : []
  if (!summary || !coveredMessageIds.length) return undefined
  return { summary, coveredMessageIds }
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
  const compression = normalizeCompression(value.compression)
  return {
    id,
    title: clampString(value.title, 80) || '未命名会话',
    createdAt: clampTimestamp(value.createdAt, updatedAt),
    updatedAt,
    messages,
    ...(compression ? { compression } : {})
  }
}

function summary(conversation: StoredAiConversationSummary): StoredAiConversationSummary {
  const { id, title, createdAt, updatedAt } = conversation
  return { id, title, createdAt, updatedAt }
}

interface HistoryEntry extends StoredAiConversationSummary {
  file: string
}

function sortedEntries(list: HistoryEntry[]): HistoryEntry[] {
  const unique = new Map<string, HistoryEntry>()
  for (const item of list) if (!unique.has(item.id)) unique.set(item.id, item)
  return [...unique.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS)
}

export class AiChatHistoryStore {
  private directory = ''
  private conversations: HistoryEntry[] = []
  private enqueue = serialQueue()

  async init(path: string): Promise<void> {
    this.directory = `${path}.d`
    await mkdir(this.directory, { recursive: true })
    try {
      const index = await readJson(this.indexPath())
      if (!isRecord(index) || index.version !== 1 || !Array.isArray(index.conversations)) throw new Error('无效的会话索引')
      this.conversations = sortedEntries(index.conversations.flatMap((value): HistoryEntry[] => {
        if (!isRecord(value) || typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) return []
        const updatedAt = clampTimestamp(value.updatedAt, Date.now())
        const file = typeof value.file === 'string' ? value.file : `${value.id}.json`
        if (!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)?\.json$/.test(file)) return []
        return [{ id: value.id, title: clampString(value.title, 80), createdAt: clampTimestamp(value.createdAt, updatedAt), updatedAt, file }]
      }))
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        await copyFile(this.indexPath(), `${this.indexPath()}.${randomUUID()}.bak`)
        this.conversations = await this.recoverEntries()
        await this.persistIndex(this.conversations)
        return
      }
    }
    let legacy: unknown
    try {
      legacy = await readJson(path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('[ai] 会话历史读取失败', error)
    }
    const normalized = Array.isArray(legacy) ? legacy.map(normalizeConversation).filter((item): item is StoredAiConversation => item !== null) : []
    const migrated = legacy === undefined
      ? await this.recoverEntries()
      : sortedEntries(normalized.map((item) => ({ ...summary(item), file: `${item.id}.json` })))
    for (const item of migrated) {
      const conversation = normalized.find((entry) => entry.id === item.id)
      if (conversation) await writeJson(this.conversationPath(item.file), conversation)
    }
    await this.persistIndex(migrated)
    this.conversations = migrated
  }

  private indexPath(): string {
    return join(this.directory, 'index.json')
  }

  private conversationPath(file: string): string {
    return join(this.directory, file)
  }

  private async recoverEntries(): Promise<HistoryEntry[]> {
    const recovered: HistoryEntry[] = []
    for (const file of await readdir(this.directory)) {
      if (file === 'index.json' || !/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)?\.json$/.test(file)) continue
      try {
        const item = normalizeConversation(await readJson(this.conversationPath(file)))
        if (item) recovered.push({ ...summary(item), file })
      } catch {
        continue
      }
    }
    return sortedEntries(recovered.sort((a, b) => b.updatedAt - a.updatedAt))
  }

  private persistIndex(list: HistoryEntry[]): Promise<void> {
    return writeJson(this.indexPath(), { version: 1, conversations: list })
  }

  list(): StoredAiConversationSummary[] {
    return this.conversations.map(summary)
  }

  get(id: string): Promise<StoredAiConversation | null> {
    return this.enqueue(async () => {
      const entry = this.conversations.find((item) => item.id === id)
      if (!entry) return null
      return normalizeConversation(await readJson(this.conversationPath(entry.file)))
    })
  }

  save(value: unknown): Promise<StoredAiConversationSummary[]> {
    const conversation = normalizeConversation(value)
    if (!conversation) return Promise.reject(new Error('无效的会话数据'))
    return this.enqueue(async () => {
      const entry = { ...summary(conversation), file: `${conversation.id}.${randomUUID()}.json` }
      const next = sortedEntries([entry, ...this.conversations.filter((item) => item.id !== conversation.id)])
      await writeJson(this.conversationPath(entry.file), conversation)
      try {
        await this.persistIndex(next)
      } catch (error) {
        await unlink(this.conversationPath(entry.file)).catch(() => undefined)
        throw error
      }
      const removed = this.conversations.filter((item) => !next.some((retained) => retained.file === item.file))
      this.conversations = next
      await Promise.all(removed.map((item) => unlink(this.conversationPath(item.file)).catch(() => undefined)))
      if (!next.some((item) => item.file === entry.file)) await unlink(this.conversationPath(entry.file)).catch(() => undefined)
      return this.list()
    })
  }

  delete(id: string): Promise<StoredAiConversationSummary[]> {
    return this.enqueue(async () => {
      const removed = this.conversations.find((item) => item.id === id)
      const next = this.conversations.filter((item) => item.id !== id)
      await this.persistIndex(next)
      this.conversations = next
      if (removed) await unlink(this.conversationPath(removed.file)).catch(() => undefined)
      return this.list()
    })
  }
}
