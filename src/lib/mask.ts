/**
 * Post-process a single-channel alpha matte in place.
 *
 * Dichotomous models often punch holes through logos/icons (e.g. the screen
 * inside a monitor frame). We fill enclosed transparent regions that are not
 * connected to the image border - those are subject holes, not background.
 */

export class EmptyMaskError extends Error {
  constructor() {
    super(
      'We could not auto-remove the background from this image. Try the Quality model, or open Edit and restore the subject with the brush.',
    );
    this.name = 'EmptyMaskError';
  }
}

/** Near-clear pixels can be walked as "outside" during hole detection. */
const OPEN = 16;

export function finalizeMask(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): void {
  fixPolarity(data, width, height);
  softenNoiseAndHoles(data);
  fillEnclosedHoles(data, width, height);
  assertUsefulMask(data);
}

/** Only invert when the matte is clearly flipped (bright border, dark center). */
export function fixPolarity(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): void {
  if (width < 8 || height < 8) return;

  const border = sampleBorderMean(data, width, height);
  const center = sampleCenterMean(data, width, height);

  if (border > 180 && center < 80) {
    for (let i = 0; i < data.length; i++) data[i] = 255 - data[i]!;
  }
}

/** Kill near-black haze; clamp near-white. Keep soft midtones for hair edges. */
export function softenNoiseAndHoles(data: Uint8Array | Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i++) {
    const v = data[i]!;
    if (v < 10) data[i] = 0;
    else if (v > 245) data[i] = 255;
  }
}

/**
 * Fill transparent regions that are fully enclosed by the subject.
 * Anything connected to the image border through clear pixels stays background.
 */
export function fillEnclosedHoles(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const n = width * height;
  if (n === 0) return;

  const outside = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;

  const enqueue = (i: number) => {
    if (outside[i]) return;
    if (data[i]! > OPEN) return;
    outside[i] = 1;
    queue[tail++] = i;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width);
    enqueue(y * width + (width - 1));
  }

  while (head < tail) {
    const i = queue[head++]!;
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) enqueue(i - 1);
    if (x + 1 < width) enqueue(i + 1);
    if (y > 0) enqueue(i - width);
    if (y + 1 < height) enqueue(i + width);
  }

  for (let i = 0; i < n; i++) {
    if (!outside[i] && data[i]! <= OPEN) data[i] = 255;
  }
}

/** Reject empty / fully-opaque mattes so we never ship a useless PNG. */
export function assertUsefulMask(data: Uint8Array | Uint8ClampedArray): void {
  const n = data.length;
  if (n === 0) throw new EmptyMaskError();

  let sum = 0;
  let opaque = 0;
  for (let i = 0; i < n; i++) {
    const v = data[i]!;
    sum += v;
    if (v >= 200) opaque++;
  }

  const mean = sum / n;
  const opaqueRatio = opaque / n;

  if (mean < 4 || mean > 252 || opaqueRatio < 0.002) {
    throw new EmptyMaskError();
  }
}

function sampleBorderMean(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const band = Math.max(1, Math.floor(Math.min(width, height) * 0.04));
  let sum = 0;
  let count = 0;

  for (let y = 0; y < height; y++) {
    const edgeY = y < band || y >= height - band;
    for (let x = 0; x < width; x++) {
      if (!edgeY && x >= band && x < width - band) continue;
      sum += data[y * width + x]!;
      count++;
    }
  }

  return count ? sum / count : 0;
}

function sampleCenterMean(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const x0 = Math.floor(width * 0.3);
  const x1 = Math.ceil(width * 0.7);
  const y0 = Math.floor(height * 0.3);
  const y1 = Math.ceil(height * 0.7);
  let sum = 0;
  let count = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      sum += data[y * width + x]!;
      count++;
    }
  }

  return count ? sum / count : 0;
}
