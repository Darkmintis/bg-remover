import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertUsefulMask,
  EmptyMaskError,
  fillEnclosedHoles,
  finalizeMask,
  fixPolarity,
  softenNoiseAndHoles,
} from '../src/lib/mask.ts';

test('fixPolarity inverts only on a strong inverted signal', () => {
  const width = 20;
  const height = 20;
  const data = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const border = x < 2 || x >= 18 || y < 2 || y >= 18;
      data[y * width + x] = border ? 240 : 20;
    }
  }

  fixPolarity(data, width, height);
  assert.ok(data[10 * width + 10] > 200, 'center should become opaque after invert');
  assert.ok(data[0] < 40, 'border should become transparent after invert');
});

test('fixPolarity leaves a normal subject matte alone', () => {
  const width = 20;
  const height = 20;
  const data = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const border = x < 2 || x >= 18 || y < 2 || y >= 18;
      data[y * width + x] = border ? 10 : 230;
    }
  }

  const before = data.slice();
  fixPolarity(data, width, height);
  assert.deepEqual(data, before);
});

test('fixPolarity ignores a weak border/center gap', () => {
  const width = 20;
  const height = 20;
  const data = new Uint8Array(width * height);
  data.fill(100);
  for (let i = 0; i < width; i++) {
    data[i] = 140;
    data[(height - 1) * width + i] = 140;
  }

  const before = data.slice();
  fixPolarity(data, width, height);
  assert.deepEqual(data, before);
});

test('softenNoiseAndHoles clears haze without crushing midtones', () => {
  const data = new Uint8Array([3, 90, 250]);
  softenNoiseAndHoles(data);
  assert.equal(data[0], 0);
  assert.equal(data[1], 90);
  assert.equal(data[2], 255);
});

test('assertUsefulMask rejects empty mattes', () => {
  assert.throws(() => assertUsefulMask(new Uint8Array(100)), EmptyMaskError);
});

test('finalizeMask keeps a normal subject', () => {
  const width = 16;
  const height = 16;
  const data = new Uint8Array(width * height);
  data.fill(5);
  for (let y = 4; y < 12; y++) {
    for (let x = 4; x < 12; x++) data[y * width + x] = 200;
  }
  finalizeMask(data, width, height);
  assert.equal(data[0], 0);
  assert.ok(data[8 * width + 8] >= 200);
});

test('fillEnclosedHoles restores punched-out icon interiors', () => {
  // Ring / monitor-frame: opaque border of a square, hollow center, clear outside.
  const width = 20;
  const height = 20;
  const data = new Uint8Array(width * height);

  for (let y = 5; y < 15; y++) {
    for (let x = 5; x < 15; x++) {
      const edge = x === 5 || x === 14 || y === 5 || y === 14;
      data[y * width + x] = edge ? 255 : 0;
    }
  }

  fillEnclosedHoles(data, width, height);
  assert.equal(data[0], 0, 'true background stays clear');
  assert.equal(data[10 * width + 10], 255, 'enclosed hole becomes opaque');
  assert.equal(data[5 * width + 5], 255, 'frame stays opaque');
});
