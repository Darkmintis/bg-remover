import { env, LogLevel, pipeline, RawImage, type ProgressInfo } from '@huggingface/transformers';
import { finalizeMask } from '../lib/mask';
import { friendlyError, MAX_SIDE, MODELS, type Tier, type DeviceKind } from '../lib/model';
import type { WorkerRequest, WorkerResponse } from '../lib/model';
import wasmAsyncifyUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import wasmAsyncifyMjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import wasmBasicUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import wasmBasicMjs from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
}

interface Segmenter {
  (image: RawImage): Promise<Array<{ mask: RawImage }>>;
  dispose(): Promise<void>;
}

const ctx = self as unknown as WorkerScope;

const userAgent = navigator.userAgent;
const isSafari =
  /Safari\//.test(userAgent) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Android/i.test(userAgent);
const useBasicWasm = isSafari && !('gpu' in navigator);

env.allowLocalModels = false;
env.useBrowserCache = true;
env.logLevel = LogLevel.ERROR;

if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.wasmPaths = useBasicWasm
    ? { wasm: wasmBasicUrl, mjs: wasmBasicMjs }
    : { wasm: wasmAsyncifyUrl, mjs: wasmAsyncifyMjs };
}

let segmenter: Segmenter | null = null;
let loadedTier: Tier | null = null;
let loadedDevice: DeviceKind | null = null;

function send(message: WorkerResponse) {
  ctx.postMessage(message);
}

function isNetworkError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return /fetch|network|status code|http|could not locate|download/.test(message);
}

async function loadSegmenter(
  tier: Tier,
  device: DeviceKind,
): Promise<{
  segmenter: Segmenter;
  tier: Tier;
  device: DeviceKind;
}> {
  if (segmenter && loadedTier === tier && loadedDevice === device) {
    return { segmenter, tier, device };
  }

  if (segmenter) {
    await segmenter.dispose().catch(() => undefined);
    segmenter = null;
    loadedTier = null;
    loadedDevice = null;
  }

  send({ type: 'loading', tier, device });

  const model = MODELS[tier];
  const progress_callback = (progress: ProgressInfo) => {
    if (progress.status !== 'progress' || !progress.total) return;
    send({
      type: 'download',
      file: progress.file?.split('/').pop() || model.label,
      loaded: progress.loaded ?? 0,
      total: progress.total,
      progress: progress.progress ?? 0,
    });
  };

  try {
    segmenter = (await pipeline('image-segmentation', model.id, {
      device,
      dtype: model.dtype[device],
      progress_callback,
    })) as unknown as Segmenter;
  } catch (error) {
    if (device === 'webgpu' && !isNetworkError(error)) {
      send({
        type: 'fallback',
        message: 'WebGPU could not run the model. Retrying on CPU with your selected model.',
      });
      return loadSegmenter(tier, 'wasm');
    }
    throw error;
  }

  loadedTier = tier;
  loadedDevice = device;
  send({ type: 'ready', tier, device });
  return { segmenter, tier, device };
}

async function decode(blob: Blob): Promise<{
  image: RawImage;
  width: number;
  height: number;
  resized: boolean;
}> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is not available in this browser.');

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const data = context.getImageData(0, 0, width, height);
  return {
    image: new RawImage(data.data, width, height, 4),
    width,
    height,
    resized: scale < 1,
  };
}

async function maskToBlob(mask: RawImage): Promise<Blob> {
  const pixels = mask.width * mask.height;
  const rgba = new Uint8ClampedArray(pixels * 4);
  for (let i = 0; i < pixels; i++) {
    const offset = i * 4;
    rgba[offset] = 255;
    rgba[offset + 1] = 255;
    rgba[offset + 2] = 255;
    rgba[offset + 3] = mask.data[i] ?? 0;
  }
  return encodeRgbaPng(rgba, mask.width, mask.height);
}

/** Apply mask alpha onto the source image and encode a real transparent PNG. */
async function composePng(image: RawImage, mask: RawImage): Promise<Blob> {
  const rgba = image.clone().rgba();
  const pixels = rgba.width * rgba.height;
  const data = rgba.data instanceof Uint8ClampedArray ? rgba.data : new Uint8ClampedArray(rgba.data);

  if (mask.width !== rgba.width || mask.height !== rgba.height) {
    throw new Error('Mask size does not match the image.');
  }

  for (let i = 0; i < pixels; i++) {
    data[i * 4 + 3] = mask.data[i] ?? 0;
  }

  return encodeRgbaPng(data, rgba.width, rgba.height);
}

async function encodeRgbaPng(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('Canvas is not available in this browser.');

  // Copy into a fresh buffer - ImageData requires ownership of the array.
  const pixels = new Uint8ClampedArray(data);
  context.putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

async function process(request: WorkerRequest) {
  let stage: 'model' | 'image' = 'model';
  try {
    const loaded = await loadSegmenter(request.tier, request.device);
    stage = 'image';
    const { image, width, height, resized } = await decode(request.blob);
    const segments = await loaded.segmenter(image);
    const mask = segments[0]?.mask;

    if (!mask) throw new Error('The model did not return a mask.');

    // Pipeline already sigmoid + resize; then polarity / hole-fill for logos.
    finalizeMask(mask.data, mask.width, mask.height);

    // Keep original RGB under the new alpha (canvas export is the reliable path).
    const resultBlob = await composePng(image, mask);
    const maskBlob = await maskToBlob(mask);

    send({
      type: 'result',
      id: request.id,
      resultBlob,
      maskBlob,
      width,
      height,
      resized,
      tier: loaded.tier,
      device: loaded.device,
    });
  } catch (error) {
    send({
      type: 'error',
      id: request.id,
      stage,
      message: friendlyError(error, request.tier),
    });
  }
}

ctx.onmessage = (event) => {
  if (event.data.type === 'process') void process(event.data);
};
