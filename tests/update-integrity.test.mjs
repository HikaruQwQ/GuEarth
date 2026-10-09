import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { compareVersions, hashFile, parseSha256 } from '../src/main/updateIntegrity.ts'

const HEX = 'a3b5c7d9e1f2031425364758697a8b9c0d1e2f30415263748596a7b8c9d0e1f2'

test('parseSha256 accepts bare lowercase or uppercase hex digests', () => {
  assert.equal(parseSha256(HEX), HEX)
  assert.equal(parseSha256(HEX.toUpperCase()), HEX)
  assert.equal(parseSha256(`  ${HEX}  `), HEX)
})

test('parseSha256 accepts Base64 and prefixed encodings', () => {
  const base64 = Buffer.from(HEX, 'hex').toString('base64')
  assert.equal(parseSha256(`sha256-${base64}`), HEX)
  assert.equal(parseSha256(`sha256:${HEX}`), HEX)
  assert.equal(parseSha256(`SHA256-${HEX.toUpperCase()}`), HEX)
})

test('parseSha256 rejects malformed or missing digests', () => {
  assert.equal(parseSha256(undefined), null)
  assert.equal(parseSha256(null), null)
  assert.equal(parseSha256(12345), null)
  assert.equal(parseSha256(''), null)
  assert.equal(parseSha256('plain text'), null)
  assert.equal(parseSha256(HEX.slice(0, 63)), null)
  assert.equal(parseSha256(`${HEX}0`), null)
  assert.equal(parseSha256('sha256-'), null)
})

test('compareVersions orders core, prerelease, and build segments', () => {
  assert.equal(compareVersions('0.1.13', '0.1.13'), 0)
  assert.equal(compareVersions('0.1.14', '0.1.13'), 1)
  assert.equal(compareVersions('0.1.9', '0.1.13'), -1)
  assert.equal(compareVersions('0.2.0', '0.1.99'), 1)
  assert.equal(compareVersions('1.0.0', '0.99.99'), 1)
  assert.equal(compareVersions('v0.2.0', '0.1.0'), 1)
  assert.equal(compareVersions('1.0', '1.0.0'), 0)
  assert.equal(compareVersions('1.0.0', '1.0.0-beta'), 1)
  assert.equal(compareVersions('1.0.0-beta', '1.0.0'), -1)
  assert.equal(compareVersions('1.0.0-alpha', '1.0.0-beta'), -1)
  assert.equal(compareVersions('1.0.0+build9', '1.0.0+build2'), 0)
})

async function withTempFile(content, run) {
  const dir = mkdtempSync(join(tmpdir(), 'guearth-hash-'))
  const path = join(dir, 'installer.bin')
  writeFileSync(path, content)
  try {
    return await run(path)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('hashFile computes the SHA-256 digest of a file', async () => {
  const payload = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(1024 * 1024, 7)])
  const digest = await withTempFile(payload, (path) => hashFile(path))
  assert.equal(digest, createHash('sha256').update(payload).digest('hex'))
  assert.match(digest, /^[0-9a-f]{64}$/)
})

test('hashFile rejects paths that do not exist', async () => {
  await assert.rejects(hashFile(join(tmpdir(), 'guearth-missing-installer.bin')))
})

test('a cached installer matches the expected digest only when byte-identical', async () => {
  const content = Buffer.from('installer-bytes')
  const expected = createHash('sha256').update(content).digest('hex')
  const digest = await withTempFile(content, (path) => hashFile(path))
  assert.equal(digest, expected)
  const tampered = await withTempFile(Buffer.from('installer-bytez'), (path) => hashFile(path))
  assert.notEqual(tampered, expected)
})
