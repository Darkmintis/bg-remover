import { useEffect, useState } from 'preact/hooks';
import { detectDevice, type DeviceInfo } from '../lib/device';
import {
  CancelledError,
  cancelProcessing,
  InferenceError,
  processImage,
  setEngineListener,
} from '../lib/engine';
import {
  isModelCached,
  type DeviceKind,
  type EngineEvent,
  type MaskResult,
  type Tier,
  type TierPreference,
} from '../lib/model';

type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ModelState {
  status: ModelStatus;
  progress: number;
  loaded: number;
  total: number;
  file: string;
  fallback: string | null;
  error: string | null;
}

export interface AppState {
  initialized: boolean;
  detected: DeviceInfo | null;
  preference: TierPreference;
  tier: Tier;
  device: DeviceKind;
  cached: boolean;
  model: ModelState;
}

const PREF_KEY = 'bg-remover:tier';

const initialState: AppState = {
  initialized: false,
  detected: null,
  preference: 'auto',
  tier: 'fast',
  device: 'wasm',
  cached: false,
  model: {
    status: 'idle',
    progress: 0,
    loaded: 0,
    total: 0,
    file: '',
    fallback: null,
    error: null,
  },
};

let state = initialState;
const listeners = new Set<() => void>();
let started = false;
let cacheCheck = 0;

function update(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function updateModel(patch: Partial<ModelState>) {
  update({ model: { ...state.model, ...patch } });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): AppState {
  return state;
}

function readPreference(): TierPreference {
  try {
    const stored = localStorage.getItem(PREF_KEY);
    if (stored === 'fast' || stored === 'quality' || stored === 'auto') return stored;
  } catch {
    // Ignore storage failures.
  }
  return 'auto';
}

function writePreference(preference: TierPreference) {
  try {
    localStorage.setItem(PREF_KEY, preference);
  } catch {
    // Ignore storage failures.
  }
}

function effectiveTier(preference: TierPreference, detected: DeviceInfo | null): Tier {
  if (preference === 'auto') return detected?.tier ?? 'fast';
  return preference;
}

async function refreshCache(tier: Tier) {
  const token = ++cacheCheck;
  const cached = await isModelCached(tier);
  if (token === cacheCheck && state.tier === tier) update({ cached });
}

function handleEngineEvent(event: EngineEvent) {
  switch (event.type) {
    case 'loading':
      update({
        tier: event.tier,
        device: event.device,
        model: { ...state.model, status: 'loading', error: null, progress: 0 },
      });
      break;
    case 'download':
      updateModel({
        status: 'loading',
        progress: event.progress,
        loaded: event.loaded,
        total: event.total,
        file: event.file,
      });
      break;
    case 'ready':
      update({
        tier: event.tier,
        device: event.device,
        cached: true,
        model: { ...state.model, status: 'ready', progress: 100, error: null },
      });
      break;
    case 'fallback':
      writePreference('fast');
      update({
        preference: 'fast',
        tier: 'fast',
        device: 'wasm',
        model: { ...state.model, fallback: event.message },
      });
      break;
    case 'error':
      updateModel({ status: 'error', error: event.message });
      break;
  }
}

export function initStore() {
  if (started) return;
  started = true;

  setEngineListener(handleEngineEvent);
  const preference = readPreference();

  void detectDevice().then((detected) => {
    update({
      initialized: true,
      detected,
      preference,
      tier: effectiveTier(preference, detected),
      device: detected.device,
    });
    void refreshCache(state.tier);
  });
}

export function setPreference(preference: TierPreference) {
  writePreference(preference);
  const tier = effectiveTier(preference, state.detected);
  update({
    preference,
    tier,
    device: state.detected?.device ?? 'wasm',
    model: {
      ...state.model,
      status: 'idle',
      progress: 0,
      loaded: 0,
      total: 0,
      file: '',
      error: null,
    },
  });
  void refreshCache(tier);
}

export function retryModel() {
  updateModel({ status: 'idle', error: null, progress: 0 });
}

export async function infer(blob: Blob): Promise<MaskResult> {
  const { tier, device } = state;
  updateModel({ status: 'loading', progress: 0, loaded: 0, total: 0, file: '', error: null });

  try {
    const result = await processImage(blob, { tier, device });
    update({
      tier: result.tier,
      device: result.device,
      cached: true,
      model: { ...state.model, status: 'ready', progress: 100, error: null },
    });
    return result;
  } catch (error) {
    if (error instanceof CancelledError) {
      updateModel({ status: 'idle', progress: 0, loaded: 0, total: 0, file: '' });
    } else if (error instanceof InferenceError) {
      if (error.stage === 'model') {
        updateModel({ status: 'error', error: error.message });
      } else {
        updateModel({ status: 'ready', progress: 0, loaded: 0, total: 0, file: '' });
      }
    } else {
      updateModel({
        status: 'error',
        error: error instanceof Error ? error.message : 'Inference failed.',
      });
    }
    throw error;
  }
}

export function cancelInference() {
  cancelProcessing();
  updateModel({ status: 'idle', progress: 0, loaded: 0, total: 0, file: '' });
}

export function useStore(): AppState {
  const [snapshot, setSnapshot] = useState(state);

  useEffect(() => subscribe(() => setSnapshot(state)), []);

  return snapshot;
}
