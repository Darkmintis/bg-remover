import { formatMB, MODELS, type TierPreference } from '../lib/model';
import { retryModel, setPreference, useStore } from '../state/store';

const OPTIONS: Array<{ value: TierPreference; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'fast', label: 'Fast' },
  { value: 'quality', label: 'Quality' },
];

export function ModelLoader() {
  const state = useStore();
  const { model } = state;
  const modelInfo = MODELS[state.tier];
  const size = formatMB(modelInfo.sizeMB[state.device]);
  const deviceLabel = state.device === 'webgpu' ? 'WebGPU' : 'CPU (WASM)';
  const percent = Math.min(100, Math.max(0, model.progress));
  const busy = model.status === 'loading';

  return (
    <section
      aria-label="Background removal model"
      class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold">AI model</h2>
            <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {deviceLabel}
            </span>
            {state.cached && (
              <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Cached
              </span>
            )}
          </div>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {modelInfo.label} · {size} · {modelInfo.license}
          </p>
        </div>

        <div
          role="group"
          aria-label="Model quality"
          class="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-950"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={busy}
              aria-pressed={state.preference === option.value}
              onClick={() => setPreference(option.value)}
              class={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                state.preference === option.value
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {busy && (
        <div class="mt-4" aria-live="polite">
          <div class="mb-1.5 flex items-center justify-between gap-3 text-xs">
            <span class="truncate text-slate-600 dark:text-slate-300">
              {model.status === 'loading' && !model.total
                ? 'Starting model…'
                : `Downloading ${model.file || modelInfo.label}…`}
            </span>
            <span class="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
              {model.total > 0
                ? `${Math.round(percent)}% · ${formatMB(model.loaded / 1e6)} / ${formatMB(model.total / 1e6)}`
                : ''}
            </span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              class="h-full rounded-full bg-emerald-500 transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p class="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            One-time download. It stays cached on your device for offline use.
          </p>
        </div>
      )}

      {model.fallback && (
        <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
          {model.fallback}
        </p>
      )}

      {model.status === 'error' && model.error && (
        <div class="mt-3 flex items-start justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/60 dark:text-red-200">
          <span>{model.error}</span>
          <button
            type="button"
            onClick={retryModel}
            class="shrink-0 font-semibold underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      {model.status === 'idle' && !model.fallback && (
        <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Loads when you process your first image. Nothing is uploaded.
        </p>
      )}

      {model.status === 'ready' && (
        <p class="mt-3 text-xs text-emerald-700 dark:text-emerald-300">
          Ready. Runs locally on your device.
        </p>
      )}
    </section>
  );
}
