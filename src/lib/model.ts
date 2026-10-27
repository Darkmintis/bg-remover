export const MAX_SIDE = 4096;

export type Tier = 'fast' | 'quality';
export type DeviceKind = 'webgpu' | 'wasm';
export type TierPreference = 'auto' | Tier;

export interface ModelInfo {
  id: string;
  label: string;
  license: string;
  source: string;
  dtype: Record<DeviceKind, 'fp16' | 'q8' | 'fp32'>;
  sizeMB: Record<DeviceKind, number>;
}

export const MODELS: Record<Tier, ModelInfo> = {
  fast: {
    id: 'onnx-community/modnet-webnn',
    label: 'MODNet',
    license: 'Apache-2.0',
    source: 'https://huggingface.co/onnx-community/modnet-webnn',
    dtype: { webgpu: 'fp16', wasm: 'q8' },
    sizeMB: { webgpu: 13, wasm: 6.6 },
  },
  quality: {
    id: 'onnx-community/BiRefNet_lite-ONNX',
    label: 'BiRefNet Lite',
    license: 'MIT',
    source: 'https://huggingface.co/onnx-community/BiRefNet_lite-ONNX',
    dtype: { webgpu: 'fp16', wasm: 'fp32' },
    sizeMB: { webgpu: 114.5, wasm: 224 },
  },
};

export interface MaskResult {
  resultBlob: Blob;
  maskBlob: Blob;
  width: number;
  height: number;
  resized: boolean;
  tier: Tier;
  device: DeviceKind;
}

export interface ProcessSettings {
  tier: Tier;
  device: DeviceKind;
}

export interface EngineProgressEvent {
  type: 'download';
  file: string;
  loaded: number;
  total: number;
  progress: number;
}

export type EngineEvent =
  | { type: 'loading'; tier: Tier; device: DeviceKind }
  | EngineProgressEvent
  | { type: 'ready'; tier: Tier; device: DeviceKind }
  | { type: 'fallback'; message: string }
  | { type: 'error'; message: string };

export interface WorkerProcessRequest {
  type: 'process';
  id: number;
  blob: Blob;
  tier: Tier;
  device: DeviceKind;
}

export type WorkerRequest = WorkerProcessRequest;

export type WorkerResponse =
  | { type: 'loading'; tier: Tier; device: DeviceKind }
  | EngineProgressEvent
  | { type: 'ready'; tier: Tier; device: DeviceKind }
  | { type: 'fallback'; message: string }
  | ({ type: 'result'; id: number } & MaskResult)
  | { type: 'error'; id: number; stage: 'model' | 'image'; message: string };

export function formatMB(mb: number): string {
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

export function friendlyError(error: unknown, tier: Tier): string {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.toLowerCase();

  if (/out of memory|allocation|oom|memory access|failed to allocate/.test(message)) {
    return 'This image is too large for your device’s memory. Try the Fast model or a smaller image.';
  }
  if (/webgpu|adapter|device lost|gpu/.test(message)) {
    return 'Your browser could not start WebGPU. Switch to the Fast model and try again.';
  }
  if (/fetch|network|failed to load|could not locate|download|status code|http/.test(message)) {
    return 'Couldn’t download the model. Check your connection, then retry.';
  }
  if (/unsupported|decode|invalid image|image format/.test(message)) {
    return 'This image couldn’t be decoded. Try a JPG, PNG, or WebP file.';
  }
  if (tier === 'quality') {
    return `The Quality model failed: ${raw || 'unknown error'}. Try the Fast model.`;
  }
  return raw || 'Something went wrong while removing the background.';
}

export async function isModelCached(tier: Tier): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    return keys.some((request) => request.url.includes(MODELS[tier].id));
  } catch {
    return false;
  }
}
