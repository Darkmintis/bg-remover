import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMB, friendlyError, MODELS } from '../src/lib/model.ts';

test('formatMB switches to whole numbers at 10 MB', () => {
  assert.equal(formatMB(6.6), '6.6 MB');
  assert.equal(formatMB(9.99), '10.0 MB');
  assert.equal(formatMB(13), '13 MB');
  assert.equal(formatMB(183), '183 MB');
});

test('friendlyError maps common failures', () => {
  assert.match(friendlyError(new Error('Failed to allocate memory'), 'quality'), /memory/i);
  assert.match(friendlyError(new Error('WebGPU adapter unavailable'), 'quality'), /WebGPU/i);
  assert.match(friendlyError(new Error('fetch failed: 500'), 'quality'), /download the model/i);
  assert.match(friendlyError(new Error('Could not decode image'), 'fast'), /couldn.t be decoded/i);
  assert.match(friendlyError(new Error('boom'), 'quality'), /Try the Fast model/);
});

test('models use permissive licenses and real dtypes', () => {
  for (const model of Object.values(MODELS)) {
    assert.match(model.license, /^(MIT|Apache-2\.0)$/);
    assert.ok(model.sizeMB.webgpu > 0 && model.sizeMB.wasm > 0);
    assert.ok(model.dtype.webgpu && model.dtype.wasm);
  }
});
