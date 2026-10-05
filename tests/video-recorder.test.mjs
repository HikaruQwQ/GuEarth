import assert from 'node:assert/strict'
import { test } from 'node:test'
import { captureSize } from '../src/renderer/src/composables/useVideoRecorder.ts'

test('capture caps oversized canvases to 1080p preserving aspect', () => {
  assert.deepEqual(captureSize({ width: 3840, height: 2160 }), { width: 1920, height: 1080 })
  assert.deepEqual(captureSize({ width: 2560, height: 1440 }), { width: 1920, height: 1080 })
  assert.deepEqual(captureSize({ width: 2400, height: 1350 }), { width: 1920, height: 1080 })
})

test('capture keeps small canvases untouched', () => {
  assert.deepEqual(captureSize({ width: 1920, height: 1080 }), { width: 1920, height: 1080 })
  assert.deepEqual(captureSize({ width: 1280, height: 720 }), { width: 1280, height: 720 })
})

test('capture emits even dimensions for the H.264 encoder', () => {
  for (const [width, height] of [[1921, 1001], [1500, 999], [3839, 2159]]) {
    const { width: w, height: h } = captureSize({ width, height })
    assert.equal(w % 2, 0)
    assert.equal(h % 2, 0)
    assert.ok(w <= 1920)
    assert.ok(h <= 1080)
  }
})
