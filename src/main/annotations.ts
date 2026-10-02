import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AnnotationData } from '../preload'

let annotationsPath = ''

export function initAnnotationsStore(userDataPath: string): void {
  annotationsPath = join(userDataPath, 'annotations.json')
}

function isAnnotation(value: unknown): value is AnnotationData {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return false
  if (record.kind !== 'point' && record.kind !== 'line' && record.kind !== 'polygon') return false
  if (typeof record.createdAt !== 'number') return false
  if (!Array.isArray(record.points) || record.points.length === 0) return false
  return record.points.every((point) => Array.isArray(point) && point.length === 2 && point.every((value) => typeof value === 'number'))
}

export function listAnnotations(): AnnotationData[] {
  if (!annotationsPath || !existsSync(annotationsPath)) return []
  try {
    const parsed: unknown = JSON.parse(readFileSync(annotationsPath, 'utf8'))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isAnnotation)
  } catch {
    return []
  }
}

function persist(annotations: AnnotationData[]): void {
  writeFileSync(annotationsPath, JSON.stringify(annotations), 'utf8')
}

export function saveAnnotation(annotation: AnnotationData): AnnotationData[] {
  if (!isAnnotation(annotation)) throw new Error('无效的标注数据')
  const next = [...listAnnotations().filter((item) => item.id !== annotation.id), annotation]
  persist(next)
  return next
}

export function deleteAnnotation(id: string): AnnotationData[] {
  const next = listAnnotations().filter((item) => item.id !== id)
  persist(next)
  return next
}
