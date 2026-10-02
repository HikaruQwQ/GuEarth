import type { AnnotationData, AnnotationGroup, AnnotationIcon, AnnotationStyle, GeoImportAsset, GroundOverlayData } from '../../../preload/types'
import { pathLengthKm, sphericalPolygonAreaKm2, type LonLat } from './measure'

export interface ParsedImport {
  groups: AnnotationGroup[]
  annotations: AnnotationData[]
  overlays: GroundOverlayData[]
}

let importSeq = 0

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++importSeq}`
}

export function kmlColorToCss(value: string): { color: string; alpha: number } {
  const normalized = value.trim().replace(/^#/, '')
  if (normalized.length !== 8) return { color: '#1677ff', alpha: 1 }
  const alpha = Number.parseInt(normalized.slice(0, 2), 16) / 255
  const blue = normalized.slice(2, 4)
  const green = normalized.slice(4, 6)
  const red = normalized.slice(6, 8)
  return { color: `#${red}${green}${blue}`, alpha: Number.isFinite(alpha) ? alpha : 1 }
}

export function cssToKmlColor(color: string, alpha: number): string {
  const normalized = color.trim().replace(/^#/, '')
  if (normalized.length !== 6) return 'ffffffff'
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${a}${normalized.slice(4, 6)}${normalized.slice(2, 4)}${normalized.slice(0, 2)}`
}

export function parseCoordinateText(text: string): LonLat[] {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => token.split(',').map((value) => Number.parseFloat(value)))
    .filter((values) => Number.isFinite(values[0]) && Number.isFinite(values[1]))
    .map((values) => [values[0], values[1]])
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case "'": return '&apos;'
      default: return '&quot;'
    }
  })
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString()
}

function coordinatesText(points: LonLat[]): string {
  return points.map((point) => `${formatNumber(point[0])},${formatNumber(point[1])},0`).join(' ')
}

interface KmlStyleRules {
  iconColor: string | null
  iconScale: number | null
  lineColor: string | null
  lineWidth: number | null
  polyColor: string | null
  fill: boolean
}

function readStyleRules(styleElement: Element | null): KmlStyleRules {
  const rules: KmlStyleRules = { iconColor: null, iconScale: null, lineColor: null, lineWidth: null, polyColor: null, fill: true }
  if (!styleElement) return rules
  const icon = styleElement.getElementsByTagName('IconStyle')[0]
  if (icon) {
    const color = icon.getElementsByTagName('Color')[0]?.textContent ?? icon.getElementsByTagName('color')[0]?.textContent
    if (color) {
      const css = kmlColorToCss(color)
      rules.iconColor = css.color
    }
    const scaleText = icon.getElementsByTagName('scale')[0]?.textContent
    const scale = scaleText !== undefined ? Number.parseFloat(scaleText) : NaN
    if (Number.isFinite(scale) && scale > 0) rules.iconScale = Math.min(6, Math.max(0.4, scale))
  }
  const line = styleElement.getElementsByTagName('LineStyle')[0]
  if (line) {
    const color = line.getElementsByTagName('color')[0]?.textContent
    if (color) rules.lineColor = kmlColorToCss(color).color
    const widthText = line.getElementsByTagName('width')[0]?.textContent
    const width = widthText !== undefined ? Number.parseFloat(widthText) : NaN
    if (Number.isFinite(width) && width > 0) rules.lineWidth = Math.min(20, Math.max(1, width))
  }
  const poly = styleElement.getElementsByTagName('PolyStyle')[0]
  if (poly) {
    const color = poly.getElementsByTagName('color')[0]?.textContent
    if (color) {
      const css = kmlColorToCss(color)
      rules.polyColor = css.color
      rules.fill = css.alpha > 0.02
    }
  }
  return rules
}

function collectStyleMap(doc: Document): Map<string, Element> {
  const resolved = new Map<string, Element>()
  const styleMaps = Array.from(doc.getElementsByTagName('*')).filter((element) => element.localName === 'StyleMap')
  for (const styleMap of styleMaps) {
    const id = styleMap.getAttribute('id')
    if (!id) continue
    let target: Element | null = null
    for (const pair of Array.from(styleMap.children)) {
      const key = pair.getElementsByTagName('key')[0]?.textContent
      if (key !== 'normal') continue
      const href = pair.getElementsByTagName('styleUrl')[0]?.textContent
      if (!href) continue
      const styleId = href.trim().replace(/^#/, '')
      target = doc.getElementById(styleId) ?? Array.from(doc.getElementsByTagName('*')).find((element) => element.localName === 'Style' && element.getAttribute('id') === styleId) ?? null
    }
    if (target) resolved.set(id, target)
  }
  return resolved
}

function styleForPlacemark(placemark: Element, styleMaps: Map<string, Element>): Element | null {
  const inline = Array.from(placemark.children).find((element) => element.localName === 'Style')
  if (inline) return inline
  const href = Array.from(placemark.getElementsByTagName('*')).find((element) => element.localName === 'styleUrl')?.textContent
  if (!href) return null
  const styleId = href.trim().replace(/^#/, '')
  const direct = Array.from(placemark.ownerDocument.getElementsByTagName('*')).find((element) => element.localName === 'Style' && element.getAttribute('id') === styleId)
  if (direct) return direct
  return styleMaps.get(styleId) ?? null
}

function annotationStyleFromRules(rules: KmlStyleRules, kind: AnnotationData['kind']): AnnotationStyle {
  const color = rules.iconColor ?? rules.lineColor ?? rules.polyColor ?? '#1677ff'
  const style: AnnotationStyle = {
    color,
    lineWidth: rules.lineWidth ?? 3,
    fillOpacity: 0.28,
    icon: 'circle' as AnnotationIcon,
    iconScale: rules.iconScale ?? 1
  }
  if (kind === 'polygon' && rules.polyColor) {
    const lineFallback = rules.lineColor ?? rules.polyColor
    return { ...style, color: lineFallback, fillOpacity: rules.fill ? 0.28 : 0 }
  }
  return style
}

function readNumberData(placemark: Element, name: string): number | null {
  for (const data of Array.from(placemark.getElementsByTagName('*')).filter((element) => element.localName === 'Data')) {
    if (data.getAttribute('name') !== name) continue
    const value = data.getElementsByTagName('value')[0]?.textContent
    const parsed = value !== undefined ? Number.parseFloat(value) : NaN
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function placemarkKind(placemark: Element): { kind: AnnotationData['kind']; points: LonLat[] } | null {
  const point = Array.from(placemark.children).find((element) => element.localName === 'Point')
  if (point) {
    const coordinates = point.getElementsByTagName('coordinates')[0]?.textContent ?? ''
    const parsed = parseCoordinateText(coordinates)
    if (parsed.length > 0) return { kind: 'point', points: [parsed[0]] }
    return null
  }
  const line = Array.from(placemark.children).find((element) => element.localName === 'LineString')
  if (line) {
    const coordinates = line.getElementsByTagName('coordinates')[0]?.textContent ?? ''
    const parsed = parseCoordinateText(coordinates)
    if (parsed.length >= 2) return { kind: 'line', points: parsed }
    return null
  }
  const polygon = Array.from(placemark.children).find((element) => element.localName === 'Polygon')
  if (polygon) {
    const coordinates = polygon.getElementsByTagName('coordinates')[0]?.textContent ?? ''
    const parsed = parseCoordinateText(coordinates)
    if (parsed.length >= 3) return { kind: 'polygon', points: parsed }
    return null
  }
  return null
}

function resolveAssetUrl(href: string, assets: GeoImportAsset[]): string | null {
  const clean = href.trim()
  if (/^https?:\/\//i.test(clean)) return clean
  const baseName = clean.split('/').pop() ?? clean
  const match = assets.find((asset) => asset.href === clean || (asset.href.split('/').pop() ?? '') === baseName)
  return match ? match.assetUrl : null
}

function parseGroundOverlay(element: Element, assets: GeoImportAsset[], folderName: string): GroundOverlayData | null {
  const iconHref = element.getElementsByTagName('href')[0]?.textContent
  if (!iconHref) return null
  const box = element.getElementsByTagName('LatLonBox')[0]
  if (!box) return null
  const north = Number.parseFloat(box.getElementsByTagName('north')[0]?.textContent ?? '')
  const south = Number.parseFloat(box.getElementsByTagName('south')[0]?.textContent ?? '')
  const east = Number.parseFloat(box.getElementsByTagName('east')[0]?.textContent ?? '')
  const west = Number.parseFloat(box.getElementsByTagName('west')[0]?.textContent ?? '')
  if (![north, south, east, west].every((value) => Number.isFinite(value))) return null
  const assetUrl = resolveAssetUrl(iconHref, assets)
  if (!assetUrl) return null
  const colorText = element.getElementsByTagName('color')[0]?.textContent
  const alpha = colorText ? kmlColorToCss(colorText).alpha : 1
  const isAsset = assetUrl.startsWith('guearth-asset://')
  return {
    id: nextId('overlay'),
    name: element.getElementsByTagName('name')[0]?.textContent?.trim() || folderName || '影像叠加',
    assetDir: isAsset ? assetUrl.replace('guearth-asset://', '').split('/')[0] : null,
    fileName: isAsset ? decodeURIComponent(assetUrl.split('/').pop() ?? '') : null,
    remoteUrl: isAsset ? null : assetUrl,
    west,
    south,
    east,
    north,
    opacity: Math.min(1, Math.max(0.05, alpha)),
    visible: true,
    createdAt: Date.now()
  }
}

export function parseKmlDocument(doc: Document, assets: GeoImportAsset[], fileName: string): ParsedImport {
  const styleMaps = collectStyleMap(doc)
  const groups: AnnotationGroup[] = []
  const annotations: AnnotationData[] = []
  const overlays: GroundOverlayData[] = []
  const root = doc.getElementsByTagName('*')[0]
  if (!root) return { groups, annotations, overlays }
  const rootName = root.getElementsByTagName('name')[0]?.textContent?.trim() || fileName.replace(/\.(kml|kmz)$/i, '')
  const ensureGroup = (path: string[]): string | null => {
    if (path.length === 0) return null
    const name = [rootName, ...path].join(' / ')
    const existing = groups.find((group) => group.name === name)
    if (existing) return existing.id
    const group = { id: nextId('group'), name, createdAt: Date.now() }
    groups.push(group)
    return group.id
  }
  const walkContainer = (container: Element, path: string[]): void => {
    for (const child of Array.from(container.children)) {
      if (child.localName === 'Folder' || child.localName === 'Document') {
        const folderName = child.getElementsByTagName('name')[0]?.textContent?.trim() || `文件夹 ${path.length + 1}`
        walkContainer(child, [...path, folderName])
        continue
      }
      if (child.localName === 'GroundOverlay') {
        const overlay = parseGroundOverlay(child, assets, path[path.length - 1] ?? '')
        if (overlay) overlays.push(overlay)
        continue
      }
      if (child.localName !== 'Placemark') continue
      const geometry = placemarkKind(child)
      if (!geometry) continue
      const rules = readStyleRules(styleForPlacemark(child, styleMaps))
      const visibility = child.getElementsByTagName('visibility')[0]?.textContent
      const name = child.getElementsByTagName('name')[0]?.textContent?.trim() || `${geometry.kind === 'point' ? '点' : geometry.kind === 'line' ? '线' : '面'} ${annotations.length + 1}`
      const distanceKm = geometry.kind === 'line' ? readNumberData(child, 'distanceKm') ?? pathLengthKm(geometry.points) : null
      const areaKm2 = geometry.kind === 'polygon' ? readNumberData(child, 'areaKm2') ?? sphericalPolygonAreaKm2(geometry.points) : null
      annotations.push({
        id: nextId('anno'),
        kind: geometry.kind,
        name,
        points: geometry.points,
        distanceKm,
        areaKm2,
        createdAt: Date.now(),
        groupId: ensureGroup(path),
        visible: visibility !== '0',
        style: annotationStyleFromRules(rules, geometry.kind)
      })
    }
  }
  walkContainer(root, [])
  return { groups, annotations, overlays }
}

export function parseGpxDocument(doc: Document, fileName: string): ParsedImport {
  const groups: AnnotationGroup[] = []
  const annotations: AnnotationData[] = []
  const root = doc.getElementsByTagName('*')[0]
  if (!root) return { groups, annotations, overlays: [] }
  const groupName = root.getElementsByTagName('name')[0]?.textContent?.trim() || fileName.replace(/\.gpx$/i, '')
  const groupId = nextId('group')
  groups.push({ id: groupId, name: groupName, createdAt: Date.now() })
  const style: AnnotationStyle = { color: '#1677ff', lineWidth: 3, fillOpacity: 0.28, icon: 'circle', iconScale: 1 }
  for (const waypoint of Array.from(root.getElementsByTagName('*')).filter((element) => element.localName === 'wpt')) {
    const lon = Number.parseFloat(waypoint.getAttribute('lon') ?? '')
    const lat = Number.parseFloat(waypoint.getAttribute('lat') ?? '')
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    annotations.push({
      id: nextId('anno'),
      kind: 'point',
      name: waypoint.getElementsByTagName('name')[0]?.textContent?.trim() || `航点 ${annotations.length + 1}`,
      points: [[lon, lat]],
      distanceKm: null,
      areaKm2: null,
      createdAt: Date.now(),
      groupId,
      visible: true,
      style
    })
  }
  const tracks = Array.from(root.getElementsByTagName('*')).filter((element) => element.localName === 'trk' || element.localName === 'rte')
  for (const track of tracks) {
    const points: LonLat[] = Array.from(track.getElementsByTagName('*'))
      .filter((element) => element.localName === 'trkpt' || element.localName === 'rtept')
      .map((point) => [Number.parseFloat(point.getAttribute('lon') ?? ''), Number.parseFloat(point.getAttribute('lat') ?? '')] as LonLat)
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))
    if (points.length < 2) continue
    annotations.push({
      id: nextId('anno'),
      kind: 'line',
      name: track.getElementsByTagName('name')[0]?.textContent?.trim() || `轨迹 ${annotations.length + 1}`,
      points,
      distanceKm: pathLengthKm(points),
      areaKm2: null,
      createdAt: Date.now(),
      groupId,
      visible: true,
      style
    })
  }
  return { groups, annotations, overlays: [] }
}

export function buildKml(
  documentName: string,
  groups: AnnotationGroup[],
  annotations: AnnotationData[],
  overlays: GroundOverlayData[],
  overlayZipPath: (overlay: GroundOverlayData) => string
): { kml: string; assets: Array<{ assetDir: string; fileName: string; zipPath: string }> } {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<kml xmlns="http://www.opengis.net/kml/2.2">')
  lines.push('<Document>')
  lines.push(`<name>${escapeXml(documentName)}</name>`)
  const styleBlock = (annotation: AnnotationData): string => {
    const style = annotation.style
    if (!style) return ''
    const blocks: string[] = []
    if (annotation.kind === 'point') {
      blocks.push(`<IconStyle><color>${cssToKmlColor(style.color, 1)}</color><scale>${formatNumber(style.iconScale)}</scale></IconStyle>`)
    }
    if (annotation.kind === 'line' || annotation.kind === 'polygon') {
      blocks.push(`<LineStyle><color>${cssToKmlColor(style.color, 1)}</color><width>${formatNumber(style.lineWidth)}</width></LineStyle>`)
    }
    if (annotation.kind === 'polygon') {
      blocks.push(`<PolyStyle><color>${cssToKmlColor(style.color, style.fillOpacity)}</color></PolyStyle>`)
    }
    if (blocks.length === 0) return ''
    return `<Style>${blocks.join('')}</Style>`
  }
  const placemarkBlock = (annotation: AnnotationData): string => {
    const parts: string[] = []
    parts.push(`<name>${escapeXml(annotation.name)}</name>`)
    if (!annotation.visible) parts.push('<visibility>0</visibility>')
    parts.push(styleBlock(annotation))
    const extended: string[] = []
    if (annotation.distanceKm !== null) extended.push(`<Data name="distanceKm"><value>${formatNumber(annotation.distanceKm)}</value></Data>`)
    if (annotation.areaKm2 !== null) extended.push(`<Data name="areaKm2"><value>${formatNumber(annotation.areaKm2)}</value></Data>`)
    if (extended.length > 0) parts.push(`<ExtendedData>${extended.join('')}</ExtendedData>`)
    if (annotation.kind === 'point') {
      parts.push(`<Point><coordinates>${formatNumber(annotation.points[0][0])},${formatNumber(annotation.points[0][1])},0</coordinates></Point>`)
    } else if (annotation.kind === 'line') {
      parts.push(`<LineString><tessellate>1</tessellate><coordinates>${coordinatesText(annotation.points)}</coordinates></LineString>`)
    } else {
      const ring = [...annotation.points, annotation.points[0]]
      parts.push(`<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinatesText(ring)}</coordinates></LinearRing></outerBoundaryIs></Polygon>`)
    }
    return `<Placemark>${parts.join('')}</Placemark>`
  }
  const assets: Array<{ assetDir: string; fileName: string; zipPath: string }> = []
  for (const overlay of overlays) {
    if (!overlay.assetDir || !overlay.fileName) continue
    const zipPath = overlayZipPath(overlay)
    lines.push('<GroundOverlay>')
    lines.push(`<name>${escapeXml(overlay.name)}</name>`)
    lines.push(`<color>${cssToKmlColor('#ffffff', overlay.opacity)}</color>`)
    lines.push(`<Icon><href>${escapeXml(zipPath)}</href></Icon>`)
    lines.push(`<LatLonBox><north>${formatNumber(overlay.north)}</north><south>${formatNumber(overlay.south)}</south><east>${formatNumber(overlay.east)}</east><west>${formatNumber(overlay.west)}</west></LatLonBox>`)
    lines.push('</GroundOverlay>')
    assets.push({ assetDir: overlay.assetDir, fileName: overlay.fileName, zipPath })
  }
  const grouped = new Map<string | null, AnnotationData[]>()
  for (const annotation of annotations) {
    const key = annotation.groupId
    grouped.set(key, [...(grouped.get(key) ?? []), annotation])
  }
  const emitFolder = (name: string, items: AnnotationData[], depth: number): void => {
    const indent = '  '.repeat(depth)
    lines.push(`${indent}<Folder>`)
    lines.push(`${indent}<name>${escapeXml(name)}</name>`)
    for (const item of items) lines.push(`${indent}${placemarkBlock(item)}`)
    lines.push(`${indent}</Folder>`)
  }
  for (const [groupId, items] of grouped) {
    if (groupId === null) {
      for (const item of items) lines.push(placemarkBlock(item))
      continue
    }
    const group = groups.find((candidate) => candidate.id === groupId)
    if (!group) {
      for (const item of items) lines.push(placemarkBlock(item))
      continue
    }
    emitFolder(group.name, items, 1)
  }
  lines.push('</Document>')
  lines.push('</kml>')
  return { kml: lines.join('\n'), assets }
}
