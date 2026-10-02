import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { AnnotationData, AnnotationGroup, AnnotationStoreData, GeoImportPayload, GroundOverlayData } from '../../../preload/types'
import { autoAnnotationName } from '@renderer/utils/measure'
import { buildKml, parseGpxDocument, parseKmlDocument } from '@renderer/utils/kml'

export type DrawMode = 'none' | 'point' | 'line' | 'polygon' | 'pick'

let annotationSeq = 0

export type FlyCapability = (lon: number, lat: number, height: number) => void

export interface ImportSummary {
  groups: number
  annotations: number
  overlays: number
}

function parsePayload(payload: GeoImportPayload): ReturnType<typeof parseKmlDocument> {
  const doc = new DOMParser().parseFromString(payload.text, 'text/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('文件内容无法解析，请确认是有效的 KML / GPX')
  return payload.format === 'kml' ? parseKmlDocument(doc, payload.assets, payload.fileName) : parseGpxDocument(doc, payload.fileName)
}

export const useDrawStore = defineStore('draw', () => {
  const panelOpen = ref(false)
  const mode = ref<DrawMode>('none')
  const draftPoints = ref<Array<[number, number]>>([])
  const annotations = ref<AnnotationData[]>([])
  const groups = ref<AnnotationGroup[]>([])
  const overlays = ref<GroundOverlayData[]>([])
  const loaded = ref(false)
  const importing = ref(false)
  const notice = ref('')

  let flyTo: FlyCapability | null = null

  function registerFly(value: FlyCapability): void {
    flyTo = value
  }

  function locate(points: Array<[number, number]>, kind: 'point' | 'line' | 'polygon'): void {
    if (!flyTo) return
    const target = kind === 'point' ? points[0] : points[Math.floor(points.length / 2)]
    flyTo(target[0], target[1], kind === 'point' ? 800000 : 2500000)
  }

  function locateOverlays(item: GroundOverlayData): void {
    if (!flyTo) return
    const lon = (item.west + item.east) / 2
    const lat = (item.south + item.north) / 2
    const span = Math.max(Math.abs(item.east - item.west), Math.abs(item.north - item.south))
    flyTo(lon, lat, Math.min(20000000, Math.max(400000, span * 120000)))
  }

  function applyStore(data: AnnotationStoreData): void {
    annotations.value = data.annotations
    groups.value = data.groups
    overlays.value = data.overlays
  }

  function setPanelOpen(value: boolean): void {
    panelOpen.value = value
  }

  function setMode(value: DrawMode): void {
    mode.value = value
    draftPoints.value = []
  }

  function addDraftPoint(point: [number, number]): void {
    draftPoints.value = [...draftPoints.value, point]
  }

  function resetDraft(): void {
    draftPoints.value = []
  }

  async function hydrate(): Promise<void> {
    if (loaded.value) return
    try {
      applyStore(await window.guEarth.annotations.list())
      loaded.value = true
    } catch {
      annotations.value = []
    }
  }

  async function addAnnotation(kind: 'point' | 'line' | 'polygon', points: Array<[number, number]>, distanceKm: number | null, areaKm2: number | null): Promise<AnnotationData> {
    const annotation: AnnotationData = {
      id: `anno-${Date.now()}-${++annotationSeq}`,
      kind,
      name: autoAnnotationName(kind, annotations.value.length + 1),
      points,
      distanceKm,
      areaKm2,
      createdAt: Date.now(),
      groupId: null,
      visible: true,
      style: null
    }
    const previous = annotations.value
    annotations.value = [...annotations.value, annotation]
    try {
      applyStore(await window.guEarth.annotations.add(annotation))
    } catch {
      annotations.value = previous
      throw new Error('标注保存失败')
    }
    return annotation
  }

  async function updateAnnotation(id: string, patch: Partial<Pick<AnnotationData, 'name' | 'visible' | 'style' | 'groupId'>>): Promise<void> {
    const target = annotations.value.find((item) => item.id === id)
    if (!target) return
    const next = { ...target, ...patch }
    const previous = annotations.value
    annotations.value = previous.map((item) => (item.id === id ? next : item))
    try {
      applyStore(await window.guEarth.annotations.update(next))
    } catch {
      annotations.value = previous
      throw new Error('标注更新失败')
    }
  }

  async function removeAnnotation(id: string): Promise<void> {
    const previous = annotations.value
    annotations.value = previous.filter((item) => item.id !== id)
    try {
      applyStore(await window.guEarth.annotations.remove(id))
    } catch {
      annotations.value = previous
      throw new Error('标注删除失败')
    }
  }

  async function setGroupVisible(groupId: string, visible: boolean): Promise<void> {
    const members = annotations.value.filter((item) => item.groupId === groupId)
    const previous = annotations.value
    annotations.value = previous.map((item) => (item.groupId === groupId ? { ...item, visible } : item))
    try {
      applyStore(await window.guEarth.annotations.saveAll({ groups: groups.value, annotations: annotations.value, overlays: overlays.value }))
    } catch {
      annotations.value = previous
      throw new Error('分组更新失败')
    }
  }

  async function removeGroup(groupId: string): Promise<void> {
    const previousAnnotations = annotations.value
    const previousGroups = groups.value
    annotations.value = previousAnnotations.filter((item) => item.groupId !== groupId)
    groups.value = previousGroups.filter((item) => item.id !== groupId)
    try {
      applyStore(await window.guEarth.annotations.saveAll({ groups: groups.value, annotations: annotations.value, overlays: overlays.value }))
    } catch {
      annotations.value = previousAnnotations
      groups.value = previousGroups
      throw new Error('分组删除失败')
    }
  }

  async function importGeo(payload: GeoImportPayload): Promise<ImportSummary> {
    const parsed = parsePayload(payload)
    const mergedGroups = [...groups.value]
    const idRemap = new Map<string, string>()
    for (const group of parsed.groups) {
      const existing = mergedGroups.find((candidate) => candidate.name === group.name)
      if (existing) {
        idRemap.set(group.id, existing.id)
        continue
      }
      mergedGroups.push(group)
    }
    const mergedAnnotations = parsed.annotations.map((annotation) => ({
      ...annotation,
      groupId: annotation.groupId ? idRemap.get(annotation.groupId) ?? annotation.groupId : null
    }))
    const next: AnnotationStoreData = {
      groups: mergedGroups,
      annotations: [...annotations.value, ...mergedAnnotations],
      overlays: [...overlays.value, ...parsed.overlays]
    }
    const summary: ImportSummary = {
      groups: parsed.groups.length - idRemap.size,
      annotations: mergedAnnotations.length,
      overlays: parsed.overlays.length
    }
    const previous: AnnotationStoreData = { groups: groups.value, annotations: annotations.value, overlays: overlays.value }
    applyStore(next)
    try {
      applyStore(await window.guEarth.annotations.saveAll(next))
    } catch {
      applyStore(previous)
      throw new Error('导入保存失败')
    }
    return summary
  }

  async function importFromFile(): Promise<ImportSummary | null> {
    importing.value = true
    notice.value = ''
    try {
      const payload = await window.guEarth.geoio.pickImport()
      if (!payload) return null
      const summary = await importGeo(payload)
      notice.value = `已导入 ${summary.annotations} 个标注${summary.overlays > 0 ? `、${summary.overlays} 幅叠加影像` : ''}`
      return summary
    } finally {
      importing.value = false
    }
  }

  async function importFromPath(filePath: string): Promise<ImportSummary> {
    importing.value = true
    notice.value = ''
    try {
      const summary = await importGeo(await window.guEarth.geoio.readFile(filePath))
      notice.value = `已导入 ${summary.annotations} 个标注${summary.overlays > 0 ? `、${summary.overlays} 幅叠加影像` : ''}`
      return summary
    } finally {
      importing.value = false
    }
  }

  async function importFromText(fileName: string, format: 'kml' | 'gpx', text: string): Promise<ImportSummary> {
    const summary = await importGeo({ fileName, format, text, assets: [] })
    notice.value = `已导入 ${summary.annotations} 个标注`
    return summary
  }

  async function exportKml(groupIds: string[] | null): Promise<boolean> {
    const exportGroups = groupIds ? groups.value.filter((group) => groupIds.includes(group.id)) : groups.value
    const exportAnnotations = annotations.value.filter((item) => !groupIds || (item.groupId !== null && groupIds.includes(item.groupId)))
    const exportOverlays = groupIds ? [] : overlays.value
    if (exportAnnotations.length === 0 && exportOverlays.length === 0) throw new Error('没有可导出的标注')
    const documentName = groupIds && groupIds.length === 1 ? exportGroups[0]?.name ?? 'GuEarth 标注' : 'GuEarth 标注'
    const { kml, assets } = buildKml(documentName, exportGroups, exportAnnotations, exportOverlays, (overlay) => `files/${overlay.fileName}`)
    const savedPath = await window.guEarth.geoio.saveKml(documentName, kml, assets)
    return savedPath !== null
  }

  async function setOverlayVisible(id: string, visible: boolean): Promise<void> {
    await updateOverlay(id, { visible })
  }

  async function setOverlayOpacity(id: string, opacity: number): Promise<void> {
    await updateOverlay(id, { opacity })
  }

  async function updateOverlay(id: string, patch: Partial<Pick<GroundOverlayData, 'visible' | 'opacity'>>): Promise<void> {
    const target = overlays.value.find((item) => item.id === id)
    if (!target) return
    const next = { ...target, ...patch }
    const previous = overlays.value
    overlays.value = previous.map((item) => (item.id === id ? next : item))
    try {
      applyStore(await window.guEarth.annotations.saveAll({ groups: groups.value, annotations: annotations.value, overlays: overlays.value }))
    } catch {
      overlays.value = previous
      throw new Error('叠加更新失败')
    }
  }

  async function removeOverlay(id: string): Promise<void> {
    const target = overlays.value.find((item) => item.id === id)
    if (!target) return
    const previous = overlays.value
    overlays.value = previous.filter((item) => item.id !== id)
    const assetDirStillUsed = overlays.value.some((item) => item.assetDir !== null && item.assetDir === target.assetDir)
    try {
      applyStore(await window.guEarth.annotations.saveAll({ groups: groups.value, annotations: annotations.value, overlays: overlays.value }))
      if (target.assetDir && !assetDirStillUsed) await window.guEarth.annotations.removeOverlayAssets(target.assetDir)
    } catch {
      overlays.value = previous
      throw new Error('叠加删除失败')
    }
  }

  function clearNotice(): void {
    notice.value = ''
  }

  return {
    panelOpen, mode, draftPoints, annotations, groups, overlays, loaded, importing, notice,
    setPanelOpen, setMode, addDraftPoint, resetDraft, hydrate,
    addAnnotation, updateAnnotation, removeAnnotation,
    setGroupVisible, removeGroup,
    importGeo, importFromFile, importFromPath, importFromText, exportKml,
    setOverlayVisible, setOverlayOpacity, removeOverlay,
    registerFly, locate, locateOverlays, clearNotice
  }
})
