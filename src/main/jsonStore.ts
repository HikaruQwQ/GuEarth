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
  await writeAtomic(path, JSON.stringify(value))
}

export async function writeAtomic(path: string, data: string | Buffer): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, data)
    await rename(temporaryPath, path)
  } finally {
    await unlink(temporaryPath).catch(() => undefined)
  }
}

export async function flushJsonWrites(): Promise<void> {
  while (pending.size) await Promise.allSettled([...pending])
}
