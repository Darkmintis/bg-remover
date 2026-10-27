import { formatMB, MODELS, type Tier } from '../lib/model';
import { retryModel, setPreference, useStore } from '../state/store';

const OPTIONS: Array<{ value: Tier; label: string; hint: string }> = [
  { value: 'quality', label: 'Quality', hint: 'Best cutout' },
  { value: 'fast', label: 'Fast', hint: 'Portraits' },
];

export function ModelLoader() {
  const state = useStore();
  const { model } = state;
  const modelInfo = MODELS[state.tier];
  const size = formatMB(modelInfo.sizeMB[state.device]);
  const deviceLabel = state.device === 'webgpu' ? 'WebGPU' : 'CPU';
  const percent = Math.min(100, Math.max(0, model.progress));
  const busy = model.status === 'loading';

  return (
    <section aria-label="Background removal model" class="surface rounded-2xl p-4 sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-sm font-semibold">Model</h2>
            <span class="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-[var(--muted)] dark:bg-white/10">
              {deviceLabel}
            </span>
            {state.cached && (
              <span class="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-medium text-teal-800 dark:text-teal-200">
                Cached
              </span>
            )}
          </div>
          <p class="mt-1 text-xs text-[var(--muted)]">
            {modelInfo.label} · {size} · {modelInfo.license}
          </p>
        </div>

        <div
          role="group"
          aria-label="Choose model"
          class="flex rounded-xl border border-[var(--surface-border)] bg-black/[0.03] p-0.5 dark:bg-white/[0.04]"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={busy}
              aria-pressed={state.preference === option.value}
              title={option.hint}
              onClick={() => setPreference(option.value)}
              class={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                state.preference === option.value
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
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
            <span class="truncate text-[var(--muted)]">
              {model.status === 'loading' && !model.total
                ? 'Starting model…'
                : `Downloading ${model.file || modelInfo.label}…`}
            </span>
            <span class="shrink-0 tabular-nums text-[var(--muted)]">
              {model.total > 0
                ? `${Math.round(percent)}% · ${formatMB(model.loaded / 1e6)} / ${formatMB(model.total / 1e6)}`
                : ''}
            </span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div
              class="relative h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            >
              <span class="progress-shine absolute inset-0" />
            </div>
          </div>
          <p class="mt-1.5 text-[11px] text-[var(--muted)]">
            One-time download. Cached on your device for offline use.
          </p>
        </div>
      )}

      {model.fallback && (
        <p class="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          {model.fallback}
        </p>
      )}

      {model.status === 'error' && model.error && (
        <div class="mt-3 flex items-start justify-between gap-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-800 dark:text-red-200">
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
        <p class="mt-3 text-xs text-[var(--muted)]">
          Pick a model, then drop an image. Quality is best for most photos; Fast is quicker for
          portraits.
        </p>
      )}

      {model.status === 'ready' && (
        <p class="mt-3 text-xs font-medium text-teal-800 dark:text-teal-200">
          Ready - running locally on your device.
        </p>
      )}
    </section>
  );
}
