import { readFile, rename, unlink, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'

const pending = new Set<Promise<unknown>>()

export function serialQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation)
    tail = result.catch(() => undefined)
    pending.add(result)
    void result.then(() => pending.delete(result), () => pending.delete(result))
    return result
  }
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  const data = JSON.stringify(value)
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, data, 'utf8')
    await rename(temporaryPath, path)
  } finally {
    await unlink(temporaryPath).catch(() => undefined)
  }
}

export async function flushJsonWrites(): Promise<void> {
  while (pending.size) await Promise.allSettled([...pending])
}
