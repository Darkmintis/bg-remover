import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import test from 'node:test';
import { fileError, isSupportedImage, outputName } from '../src/lib/files.ts';

test('accepts jpg, png, and webp by MIME type', () => {
  for (const type of ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']) {
    assert.equal(isSupportedImage(new File([], 'image.bin', { type })), true, type);
  }
});

test('falls back to the extension when the type is missing', () => {
  assert.equal(isSupportedImage(new File([], 'photo.JPG', { type: '' })), true);
  assert.equal(isSupportedImage(new File([], 'photo.webp', { type: '' })), true);
});

test('rejects gifs and other files', () => {
  const gif = new File([], 'animation.gif', { type: 'image/gif' });
  assert.equal(isSupportedImage(gif), false);
  assert.match(fileError(gif), /isn.t a JPG, PNG, or WebP/);
});

test('outputName keeps the stem and adds the suffix', () => {
  assert.equal(outputName('photo.jpg', 'png'), 'photo-no-bg.png');
  assert.equal(outputName('my.photo.final.webp', 'webp'), 'my.photo.final-no-bg.webp');
  assert.equal(outputName('.hidden', 'png'), 'image-no-bg.png');
});
