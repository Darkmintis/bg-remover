import assert from 'node:assert/strict';
import test from 'node:test';
import { canvasPoint, clamp, coverRect } from '../src/lib/geometry.ts';

test('clamp keeps values in range', () => {
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(5, 0, 10), 5);
});

test('coverRect fills and centers a landscape image', () => {
  assert.deepEqual(coverRect(200, 100, 100, 100), {
    x: -50,
    y: 0,
    width: 200,
    height: 100,
  });
});

test('coverRect fills and centers a portrait image', () => {
  assert.deepEqual(coverRect(100, 200, 100, 100), {
    x: 0,
    y: -50,
    width: 100,
    height: 200,
  });
});

test('canvasPoint maps display coordinates to image pixels', () => {
  const rect = { left: 10, top: 20, width: 500, height: 250 };
  assert.deepEqual(canvasPoint(260, 145, rect, 1000, 500), { x: 500, y: 250 });
  assert.deepEqual(canvasPoint(-100, -100, rect, 1000, 500), { x: 0, y: 0 });
});
