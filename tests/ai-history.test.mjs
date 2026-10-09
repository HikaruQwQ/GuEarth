import assert from 'node:assert/strict'
import { test } from 'node:test'
import { registerHooks } from 'node:module'
import { mkdtemp, readFile, writeFile, readdir, rename, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context)
      throw error
    }
  }
})

const { AiChatHistoryStore } = await import('../src/main/ai/chatHistoryStore.ts')
const { AiMemoryStore } = await import('../src/main/ai/memoryStore.ts')
const { serialQueue, flushJsonWrites } = await import('../src/main/jsonStore.ts')

function conversation(id, updatedAt = 1, content = '地理问题') {
  return {
    id, title: id, createdAt: 1, updatedAt,
    messages: [
      { id: 'u1', role: 'user', content, parts: [], status: 'done', error: '' },
      { id: 'a1', role: 'assistant', content: '回答', parts: [{ kind: 'reasoning', id: 'r1', text: '推理', ms: 12, startedAt: 1 }, { kind: 'text', text: '回答' }], status: 'error', error: '连接中断' }
    ],
    compression: { summary: '历史摘要', coveredMessageIds: ['u1'] }
  }
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'guearth-history-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return { path: join(directory, 'history.json'), directory }
}

test('migrates legacy history preserving messages, compression and the original file', async (t) => {
  const { path } = await fixture(t)
  const original = JSON.stringify([conversation('older', 1), conversation('newer', 2)])
  await writeFile(path, original)
  const store = new AiChatHistoryStore()
  await store.init(path)
  assert.deepEqual(store.list().map((item) => item.id), ['newer', 'older'])
  assert.equal('messages' in store.list()[0], false)
  assert.deepEqual(await store.get('newer'), conversation('newer', 2))
  assert.equal(await readFile(path, 'utf8'), original)
  const reopened = new AiChatHistoryStore()
  await reopened.init(path)
  assert.deepEqual(await reopened.get('older'), conversation('older'))
})

test('loads only the selected conversation body and rejects unknown paths', async (t) => {
  const { path } = await fixture(t)
  const store = new AiChatHistoryStore()
  await store.init(path)
  await store.save(conversation('healthy'))
  await store.save(conversation('broken', 2))
  const index = JSON.parse(await readFile(join(`${path}.d`, 'index.json'), 'utf8'))
  await writeFile(join(`${path}.d`, index.conversations.find((item) => item.id === 'broken').file), '{')
  const reopened = new AiChatHistoryStore()
  await reopened.init(path)
  assert.equal(reopened.list().length, 2)
  assert.deepEqual(await reopened.get('healthy'), conversation('healthy'))
  await assert.rejects(reopened.get('broken'), SyntaxError)
  assert.equal(await reopened.get('../index'), null)
  await assert.rejects(reopened.save(conversation('../index')))
})

test('serializes concurrent updates and deletes, retaining the last committed body', async (t) => {
  const { path } = await fixture(t)
  const store = new AiChatHistoryStore()
  await store.init(path)
  await Promise.all(Array.from({ length: 12 }, (_, i) => store.save(conversation('same', i, `question-${i}`))))
  assert.equal((await store.get('same')).messages[0].content, 'question-11')
  assert.equal((await readdir(`${path}.d`)).length, 2)
  await Promise.all([store.save(conversation('same', 12)), store.delete('same'), store.save(conversation('replacement', 13))])
  assert.deepEqual(store.list().map((item) => item.id), ['replacement'])
  const reopened = new AiChatHistoryStore()
  await reopened.init(path)
  assert.deepEqual(reopened.list(), store.list())
})

test('failed manifest writes preserve the previously committed conversation', async (t) => {
  const { path } = await fixture(t)
  const store = new AiChatHistoryStore()
  await store.init(path)
  await store.save(conversation('same'))
  const indexPath = join(`${path}.d`, 'index.json')
  await rename(indexPath, `${indexPath}.saved`)
  await mkdir(indexPath)
  await assert.rejects(store.save(conversation('same', 2, 'uncommitted')))
  assert.deepEqual(await store.get('same'), conversation('same'))
  await rm(indexPath, { recursive: true })
  await rename(`${indexPath}.saved`, indexPath)
  await store.save(conversation('same', 3, 'committed'))
  assert.equal((await store.get('same')).messages[0].content, 'committed')
  assert.equal((await readdir(`${path}.d`)).length, 2)
})

test('retention removes evicted bodies and keeps exactly fifty summaries', async (t) => {
  const { path } = await fixture(t)
  const store = new AiChatHistoryStore()
  await store.init(path)
  await Promise.all(Array.from({ length: 53 }, (_, i) => store.save(conversation(`c${i}`, i))))
  assert.equal(store.list().length, 50)
  assert.equal(await store.get('c0'), null)
  assert.equal(store.list()[0].id, 'c52')
  assert.equal((await readdir(`${path}.d`)).length, 51)
})

test('recovers a corrupt manifest and preserves its original bytes', async (t) => {
  const { path } = await fixture(t)
  const store = new AiChatHistoryStore()
  await store.init(path)
  await store.save(conversation('recover'))
  await writeFile(join(`${path}.d`, 'index.json'), '{broken')
  const reopened = new AiChatHistoryStore()
  await reopened.init(path)
  assert.deepEqual(await reopened.get('recover'), conversation('recover'))
  const backup = (await readdir(`${path}.d`)).find((file) => file.endsWith('.bak'))
  assert.equal(await readFile(join(`${path}.d`, backup), 'utf8'), '{broken')
})

test('concurrent memory changes persist without dropping earlier changes', async (t) => {
  const { directory } = await fixture(t)
  const path = join(directory, 'memories.json')
  const store = new AiMemoryStore()
  await store.init(path)
  const added = await Promise.all(Array.from({ length: 10 }, (_, i) => store.add(`memory-${i}`, 'user')))
  await Promise.all([store.delete(added[0].id), store.add('last', 'agent')])
  const reopened = new AiMemoryStore()
  await reopened.init(path)
  assert.equal(reopened.list().length, 10)
  assert.equal(reopened.list().some((item) => item.id === added[0].id), false)
  assert.equal(reopened.list().at(-1).content, 'last')
})

test('shutdown flush waits for queued operations after an earlier failure', async () => {
  const enqueue = serialQueue()
  const order = []
  const rejected = enqueue(async () => { throw new Error('failed') })
  await assert.rejects(rejected)
  const saved = enqueue(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    order.push('saved')
  })
  await flushJsonWrites()
  assert.deepEqual(order, ['saved'])
  await saved
})
