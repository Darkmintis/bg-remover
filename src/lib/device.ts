import type { DeviceKind, Tier } from './model';

interface GpuLike {
  requestAdapter(): Promise<unknown>;
}

export interface DeviceInfo {
  device: DeviceKind;
  tier: Tier;
  webgpu: boolean;
  lowEnd: boolean;
  memory?: number;
  cores: number;
}

async function hasWebGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: GpuLike }).gpu;
  if (!gpu) return false;

  try {
    const adapter = await Promise.race([
      gpu.requestAdapter(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    return adapter !== null && adapter !== undefined;
  } catch {
    return false;
  }
}

export async function detectDevice(): Promise<DeviceInfo> {
  const webgpu = await hasWebGpu();
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const lowEnd = mobile || cores <= 4 || (memory !== undefined && memory < 4);

  return {
    device: webgpu ? 'webgpu' : 'wasm',
    tier: webgpu && !lowEnd ? 'quality' : 'fast',
    webgpu,
    lowEnd,
    memory,
    cores,
  };
}
