import { inflateRawSync, deflateRawSync } from 'zlib'

export interface ZipEntry {
  name: string
  data: Buffer
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function readUint16(data: Buffer, offset: number): number {
  return data.readUInt16LE(offset)
}

function readUint32(data: Buffer, offset: number): number {
  return data.readUInt32LE(offset)
}

function decodeName(raw: Buffer, utf8: boolean): string {
  if (utf8) return raw.toString('utf8')
  try {
    return new TextDecoder('gbk').decode(raw)
  } catch {
    return raw.toString('utf8')
  }
}

export function unzip(buffer: Buffer): ZipEntry[] {
  const eocdMarker = 0x06054b50
  let eocd = -1
  for (let i = buffer.length - 22; i >= 0 && i >= buffer.length - 22 - 65536; i--) {
    if (readUint32(buffer, i) === eocdMarker) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('无效的 KMZ 文件')
  const entryCount = readUint16(buffer, eocd + 10)
  let offset = readUint32(buffer, eocd + 16)
  const entries: ZipEntry[] = []
  for (let index = 0; index < entryCount; index++) {
    if (readUint32(buffer, offset) !== 0x02014b50) throw new Error('无效的 KMZ 条目')
    const flags = readUint16(buffer, offset + 8)
    const method = readUint16(buffer, offset + 10)
    const compressedSize = readUint32(buffer, offset + 20)
    const nameLength = readUint16(buffer, offset + 28)
    const extraLength = readUint16(buffer, offset + 30)
    const commentLength = readUint16(buffer, offset + 32)
    const localOffset = readUint32(buffer, offset + 42)
    const name = decodeName(buffer.subarray(offset + 46, offset + 46 + nameLength), (flags & 0x800) !== 0)
    if (name.endsWith('/')) {
      offset += 46 + nameLength + extraLength + commentLength
      continue
    }
    const localNameLength = readUint16(buffer, localOffset + 26)
    const localExtraLength = readUint16(buffer, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize)
    let data: Buffer
    if (method === 0) data = Buffer.from(compressed)
    else if (method === 8) data = inflateRawSync(compressed)
    else throw new Error(`不支持的压缩方式: ${method}`)
    entries.push({ name, data })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

export function zipFiles(entries: ZipEntry[]): Buffer {
  const localChunks: Buffer[] = []
  const centralChunks: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8')
    const crc = crc32(entry.data)
    const compressed = deflateRawSync(entry.data, { level: 6 })
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0x2821, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(entry.data.length, 22)
    local.writeUInt16LE(nameBuffer.length, 26)
    local.writeUInt16LE(0, 28)
    localChunks.push(local, nameBuffer, compressed)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x2821, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(entry.data.length, 24)
    central.writeUInt16LE(nameBuffer.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centralChunks.push(central, nameBuffer)
    offset += local.length + nameBuffer.length + compressed.length
  }
  const centralDirectory = Buffer.concat(centralChunks)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralDirectory.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...localChunks, centralDirectory, eocd])
}
