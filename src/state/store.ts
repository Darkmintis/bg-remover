import { useEffect, useState } from 'preact/hooks';
import { detectDevice, type DeviceInfo } from '../lib/device';
import {
  CancelledError,
  cancelProcessing,
  InferenceError,
  processImage,
  setEngineListener,
} from '../lib/engine';
import { downloadBlob, fileError, outputName } from '../lib/files';
import {
  friendlyError,
  isModelCached,
  type DeviceKind,
  type EngineEvent,
  type MaskResult,
  type Tier,
  type TierPreference,
} from '../lib/model';
import { makeZip } from '../lib/zip';

type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ImageStatus = 'waiting' | 'processing' | 'done' | 'failed';

export interface ImageItem {
  id: string;
  file: File;
  sourceUrl: string;
  result: MaskResult | null;
  resultUrl: string | null;
  status: ImageStatus;
  error: string | null;
}

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
  items: ImageItem[];
  selectedId: string | null;
  running: boolean;
}

const PREF_KEY = 'bg-remover:tier';

const initialState: AppState = {
  initialized: false,
  detected: null,
  preference: 'quality',
  tier: 'quality',
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
  items: [],
  selectedId: null,
  running: false,
};

let state = initialState;
const listeners = new Set<() => void>();
let started = false;
let cacheCheck = 0;
let nextId = 0;
let running = false;
let runToken = 0;
let rerun = false;

function update(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function updateModel(patch: Partial<ModelState>) {
  update({ model: { ...state.model, ...patch } });
}

function updateItem(id: string, patch: Partial<ImageItem>) {
  update({
    items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  });
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
    if (stored === 'fast' || stored === 'quality') return stored;
    // Migrate old "auto" preference to Quality.
    if (stored === 'auto') return 'quality';
  } catch {
    // Ignore storage failures.
  }
  return 'quality';
}

function writePreference(preference: TierPreference) {
  try {
    localStorage.setItem(PREF_KEY, preference);
  } catch {
    // Ignore storage failures.
  }
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
      update({
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
      tier: preference,
      device: detected.device,
    });
    void refreshCache(state.tier);
  });
}

export function setPreference(preference: TierPreference) {
  writePreference(preference);
  update({
    preference,
    tier: preference,
    device: state.detected?.device ?? 'wasm',
    model: {
      ...state.model,
      status: 'idle',
      progress: 0,
      loaded: 0,
      total: 0,
      file: '',
      error: null,
      fallback: null,
    },
  });
  void refreshCache(preference);
}

export function retryModel() {
  updateModel({ status: 'idle', error: null, progress: 0 });
}

export async function infer(blob: Blob): Promise<MaskResult> {
  const { tier, device } = state;
  if (state.model.status !== 'ready') {
    updateModel({ status: 'loading', progress: 0, loaded: 0, total: 0, file: '', error: null });
  }

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

function revokeItem(item: ImageItem) {
  URL.revokeObjectURL(item.sourceUrl);
  if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
}

export function addFiles(files: File[]): { added: number; rejected: string[] } {
  const accepted: ImageItem[] = [];
  const rejected: string[] = [];

  for (const file of files) {
    const error = fileError(file);
    if (error) {
      rejected.push(error);
      continue;
    }
    nextId += 1;
    accepted.push({
      id: `image-${nextId}`,
      file,
      sourceUrl: URL.createObjectURL(file),
      result: null,
      resultUrl: null,
      status: 'waiting',
      error: null,
    });
  }

  if (accepted.length === 0) return { added: 0, rejected };

  update({
    items: [...state.items, ...accepted],
    selectedId: state.selectedId ?? accepted[0].id,
  });
  void runQueue();
  return { added: accepted.length, rejected };
}

async function runQueue() {
  if (running) {
    rerun = true;
    return;
  }

  running = true;
  const token = ++runToken;
  update({ running: true });

  try {
    while (token === runToken) {
      const next = state.items.find((item) => item.status === 'waiting');
      if (!next) break;

      if (!state.selectedId) update({ selectedId: next.id });
      updateItem(next.id, { status: 'processing', error: null });

      try {
        const result = await infer(next.file);

        if (token !== runToken) {
          if (state.items.some((item) => item.id === next.id)) {
            updateItem(next.id, { status: 'waiting', error: null });
          }
          break;
        }

        updateItem(next.id, {
          result,
          resultUrl: URL.createObjectURL(result.resultBlob),
          status: 'done',
          error: null,
        });
      } catch (error) {
        if (token !== runToken || error instanceof CancelledError) {
          if (state.items.some((item) => item.id === next.id)) {
            updateItem(next.id, { status: 'waiting', error: null });
          }
          break;
        }

        const message =
          error instanceof InferenceError ? error.message : friendlyError(error, state.tier);
        updateItem(next.id, { status: 'failed', error: message });

        if (error instanceof InferenceError && error.stage === 'model') break;
      }
    }
  } finally {
    running = false;
    update({ running: false });
    if (rerun) {
      rerun = false;
      void runQueue();
    }
  }
}

export function cancelQueue() {
  if (!running) return;
  runToken += 1;
  rerun = false;
  cancelInference();
  update({ running: false });
}

export function startQueue() {
  void runQueue();
}

export function retryFailed() {
  if (!state.items.some((item) => item.status === 'failed')) return;
  update({
    items: state.items.map((item) =>
      item.status === 'failed' ? { ...item, status: 'waiting', error: null } : item,
    ),
  });
  void runQueue();
}

export function removeItem(id: string) {
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item || item.status === 'processing') return;

  revokeItem(item);
  const items = state.items.filter((candidate) => candidate.id !== id);
  update({
    items,
    selectedId: state.selectedId === id ? (items[0]?.id ?? null) : state.selectedId,
  });
}

export function clearAll() {
  if (running) {
    runToken += 1;
    rerun = false;
    cancelInference();
  }
  for (const item of state.items) revokeItem(item);
  update({ items: [], selectedId: null, running: false });
}

export function selectItem(id: string) {
  if (state.items.some((item) => item.id === id)) update({ selectedId: id });
}

export interface EditResult {
  resultBlob: Blob;
  maskBlob: Blob;
  width: number;
  height: number;
}

export function applyEdit(id: string, edit: EditResult) {
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item?.result) return;

  if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
  const result = {
    ...item.result,
    resultBlob: edit.resultBlob,
    maskBlob: edit.maskBlob,
    width: edit.width,
    height: edit.height,
  };
  updateItem(id, {
    result,
    resultUrl: URL.createObjectURL(edit.resultBlob),
  });
}

export function downloadItem(id: string) {
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item?.result) return;
  downloadBlob(item.result.resultBlob, outputName(item.file.name, 'png'));
}

export async function downloadZip() {
  const done = state.items.filter((item) => item.result);
  if (done.length === 0) return;

  const zip = await makeZip(
    done.map((item) => ({
      name: outputName(item.file.name, 'png'),
      blob: item.result!.resultBlob,
    })),
  );
  downloadBlob(zip, 'bg-remover-images.zip');
}

export function useStore(): AppState {
  const [snapshot, setSnapshot] = useState(state);

  useEffect(() => subscribe(() => setSnapshot(state)), []);

  return snapshot;
}
