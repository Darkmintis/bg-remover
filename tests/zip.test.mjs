import assert from 'node:assert/strict';
import test from 'node:test';
import { unzipSync } from 'fflate';
import { makeZip } from '../src/lib/zip.ts';

test('makeZip stores every blob and de-duplicates names', async () => {
  const zip = await makeZip([
    { name: 'photo-no-bg.png', blob: new Blob(['first']) },
    { name: 'photo-no-bg.png', blob: new Blob(['second']) },
  ]);

  const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  assert.deepEqual(Object.keys(files).sort(), ['photo-no-bg-2.png', 'photo-no-bg.png']);

  const decoder = new TextDecoder();
  assert.equal(decoder.decode(files['photo-no-bg.png']), 'first');
  assert.equal(decoder.decode(files['photo-no-bg-2.png']), 'second');
});
