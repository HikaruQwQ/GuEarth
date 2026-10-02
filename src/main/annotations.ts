import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AnnotationData, AnnotationGroup, AnnotationStoreData, AnnotationStyle, GroundOverlayData } from '../preload'

let annotationsPath = ''

const emptyStore: AnnotationStoreData = { groups: [], annotations: [], overlays: [] }

export function initAnnotationsStore(userDataPath: string): void {
  annotationsPath = join(userDataPath, 'annotations.json')
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function isAnnotationStyle(value: unknown): value is AnnotationStyle {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (!isColor(record.color)) return false
  if (typeof record.lineWidth !== 'number' || !(record.lineWidth >= 1) || record.lineWidth > 20) return false
  if (typeof record.fillOpacity !== 'number' || record.fillOpacity < 0 || record.fillOpacity > 1) return false
  if (typeof record.iconScale !== 'number' || record.iconScale <= 0 || record.iconScale > 6) return false
  return record.icon === 'circle' || record.icon === 'triangle' || record.icon === 'star' || record.icon === 'pin'
}

function isAnnotation(value: unknown): value is AnnotationData {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return false
  if (record.kind !== 'point' && record.kind !== 'line' && record.kind !== 'polygon') return false
  if (typeof record.createdAt !== 'number') return false
  if (!Array.isArray(record.points) || record.points.length === 0) return false
  if (!record.points.every((point) => Array.isArray(point) && point.length === 2 && point.every((value) => typeof value === 'number'))) return false
  if (record.groupId !== null && typeof record.groupId !== 'string') return false
  if (record.visible !== undefined && typeof record.visible !== 'boolean') return false
  if (record.style !== null && record.style !== undefined && !isAnnotationStyle(record.style)) return false
  return true
}

function isGroup(value: unknown): value is AnnotationGroup {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.name === 'string' && typeof record.createdAt === 'number'
}

function isOverlay(value: unknown): value is GroundOverlayData {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.name !== 'string' || typeof record.createdAt !== 'number') return false
  for (const key of ['west', 'south', 'east', 'north'] as const) {
    if (typeof record[key] !== 'number' || !Number.isFinite(record[key])) return false
  }
  if (typeof record.opacity !== 'number' || record.opacity < 0 || record.opacity > 1) return false
  if (typeof record.visible !== 'boolean') return false
  if (record.assetDir !== null && typeof record.assetDir !== 'string') return false
  if (record.fileName !== null && typeof record.fileName !== 'string') return false
  if (record.remoteUrl !== null && typeof record.remoteUrl !== 'string') return false
  return record.assetDir !== null || record.remoteUrl !== null
}

function normalizeAnnotation(value: unknown): AnnotationData | null {
  if (!isAnnotation(value)) return null
  return {
    ...value,
    groupId: value.groupId ?? null,
    visible: value.visible !== false,
    style: value.style ?? null,
    distanceKm: value.distanceKm ?? null,
    areaKm2: value.areaKm2 ?? null
  }
}

export function listAnnotationStore(): AnnotationStoreData {
  if (!annotationsPath || !existsSync(annotationsPath)) return { groups: [], annotations: [], overlays: [] }
  try {
    const parsed: unknown = JSON.parse(readFileSync(annotationsPath, 'utf8'))
    if (Array.isArray(parsed)) {
      return { ...emptyStore, annotations: parsed.map(normalizeAnnotation).filter((item): item is AnnotationData => item !== null) }
    }
    if (typeof parsed !== 'object' || parsed === null) return { ...emptyStore }
    const record = parsed as Record<string, unknown>
    const groups = Array.isArray(record.groups) ? record.groups.filter(isGroup) : []
    const annotations = Array.isArray(record.annotations) ? record.annotations.map(normalizeAnnotation).filter((item): item is AnnotationData => item !== null) : []
    const overlays = Array.isArray(record.overlays) ? record.overlays.filter(isOverlay) : []
    const groupIds = new Set(groups.map((group) => group.id))
    return {
      groups,
      annotations: annotations.map((annotation) => (annotation.groupId && groupIds.has(annotation.groupId) ? annotation : { ...annotation, groupId: null })),
      overlays
    }
  } catch {
    return { ...emptyStore }
  }
}

function persist(store: AnnotationStoreData): void {
  writeFileSync(annotationsPath, JSON.stringify(store), 'utf8')
}

export function saveAnnotationStore(next: AnnotationStoreData): AnnotationStoreData {
  const validated: AnnotationStoreData = {
    groups: next.groups.filter(isGroup),
    annotations: next.annotations.map(normalizeAnnotation).filter((item): item is AnnotationData => item !== null),
    overlays: next.overlays.filter(isOverlay)
  }
  persist(validated)
  return listAnnotationStore()
}

export function saveAnnotation(annotation: AnnotationData): AnnotationStoreData {
  const normalized = normalizeAnnotation(annotation)
  if (!normalized) throw new Error('无效的标注数据')
  const store = listAnnotationStore()
  persist({ ...store, annotations: [...store.annotations.filter((item) => item.id !== normalized.id), normalized] })
  return listAnnotationStore()
}

export function updateAnnotation(annotation: AnnotationData): AnnotationStoreData {
  return saveAnnotation(annotation)
}

export function deleteAnnotation(id: string): AnnotationStoreData {
  const store = listAnnotationStore()
  persist({ ...store, annotations: store.annotations.filter((item) => item.id !== id) })
  return listAnnotationStore()
}
