import type {
  EngineEvent,
  MaskResult,
  ProcessSettings,
  WorkerRequest,
  WorkerResponse,
} from './model';

export class CancelledError extends Error {
  constructor() {
    super('Processing was cancelled.');
    this.name = 'CancelledError';
  }
}

export class InferenceError extends Error {
  stage: 'model' | 'image';

  constructor(message: string, stage: 'model' | 'image') {
    super(message);
    this.name = 'InferenceError';
    this.stage = stage;
  }
}

interface Pending {
  resolve: (result: MaskResult) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let workerKey = '';
let seq = 0;
let listener: ((event: EngineEvent) => void) | null = null;
const pending = new Map<number, Pending>();

export function setEngineListener(fn: ((event: EngineEvent) => void) | null) {
  listener = fn;
}

function failAll(error: Error) {
  for (const item of pending.values()) item.reject(error);
  pending.clear();
}

function handleMessage(event: MessageEvent<WorkerResponse>) {
  const message = event.data;

  if (message.type === 'result') {
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    const { id: _id, type: _type, ...result } = message;
    item.resolve(result);
    return;
  }

  if (message.type === 'error') {
    const item = pending.get(message.id);
    if (item) {
      pending.delete(message.id);
      item.reject(new InferenceError(message.message, message.stage));
    }
    return;
  }

  listener?.(message);
}

function ensureWorker(key: string): Worker {
  if (worker && workerKey === key) return worker;

  if (worker) {
    worker.terminate();
    worker = null;
    failAll(new CancelledError());
  }

  worker = new Worker(new URL('../workers/inference.worker.ts', import.meta.url), {
    type: 'module',
  });
  workerKey = key;

  worker.onmessage = handleMessage;
  worker.onerror = (event) => {
    event.preventDefault();
    const message = event.message || 'The inference worker crashed.';
    failAll(new Error(message));
    listener?.({ type: 'error', message });
    worker?.terminate();
    worker = null;
    workerKey = '';
  };

  return worker;
}

export function processImage(blob: Blob, settings: ProcessSettings): Promise<MaskResult> {
  if (pending.size > 0) {
    return Promise.reject(new Error('An image is already being processed.'));
  }

  const current = ensureWorker(`${settings.tier}:${settings.device}`);
  const id = ++seq;

  return new Promise<MaskResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: WorkerRequest = { type: 'process', id, blob, ...settings };
    current.postMessage(request);
  });
}

export function cancelProcessing() {
  if (!worker) return;
  worker.terminate();
  worker = null;
  workerKey = '';
  failAll(new CancelledError());
}

export function disposeEngine() {
  cancelProcessing();
  listener = null;
}
