import { useState } from 'preact/hooks';
import type { ImageStatus } from '../state/store';
import {
  cancelQueue,
  clearAll,
  downloadItem,
  downloadZip,
  removeItem,
  retryFailed,
  selectItem,
  startQueue,
  useStore,
} from '../state/store';

const STATUS_LABEL: Record<ImageStatus, string> = {
  waiting: 'Waiting',
  processing: 'Removing…',
  done: 'Done',
  failed: 'Failed',
};

const STATUS_STYLE: Record<ImageStatus, string> = {
  waiting: 'bg-black/5 text-[var(--muted)] dark:bg-white/10',
  processing: 'bg-teal-500/15 text-teal-800 dark:text-teal-200',
  done: 'bg-teal-500/15 text-teal-800 dark:text-teal-200',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-300',
};

export function Queue() {
  const state = useStore();
  const [zipping, setZipping] = useState(false);
  const { items } = state;

  if (items.length === 0) return null;

  const done = items.filter((item) => item.status === 'done').length;
  const failed = items.filter((item) => item.status === 'failed').length;
  const waiting = items.filter((item) => item.status === 'waiting').length;
  const finished = done + failed;
  const percent = Math.round((finished / items.length) * 100);

  async function handleZip() {
    setZipping(true);
    try {
      await downloadZip();
    } finally {
      setZipping(false);
    }
  }

  return (
    <section aria-label="Processing queue" class="surface rounded-3xl p-4 sm:p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold">Queue</h2>
          <p class="text-xs text-[var(--muted)]">
            {done} of {items.length} done{failed > 0 ? ` · ${failed} failed` : ''}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          {state.running && (
            <button type="button" onClick={cancelQueue} class="btn-ghost rounded-xl px-3 py-1.5 text-xs font-semibold">
              Cancel
            </button>
          )}
          {!state.running && waiting > 0 && (
            <button type="button" onClick={startQueue} class="btn-ghost rounded-xl px-3 py-1.5 text-xs font-semibold">
              Resume
            </button>
          )}
          {failed > 0 && (
            <button type="button" onClick={retryFailed} class="btn-ghost rounded-xl px-3 py-1.5 text-xs font-semibold">
              Retry failed
            </button>
          )}
          {done > 0 && (
            <button
              type="button"
              disabled={zipping}
              onClick={handleZip}
              class="btn-primary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:cursor-wait disabled:opacity-60"
            >
              {zipping ? 'Zipping…' : 'Download all (ZIP)'}
            </button>
          )}
          <button type="button" onClick={clearAll} class="btn-ghost rounded-xl px-3 py-1.5 text-xs font-semibold">
            Clear
          </button>
        </div>
      </div>

      <div class="mt-3" aria-hidden="true">
        <div class="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div
            class="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <p class="sr-only" aria-live="polite">
        {finished} of {items.length} images finished.
      </p>

      <ul class="mt-3 max-h-96 divide-y divide-black/5 overflow-y-auto dark:divide-white/10">
        {items.map((item) => {
          const selected = item.id === state.selectedId;
          return (
            <li
              key={item.id}
              class={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2 ${selected ? 'bg-teal-500/10' : ''}`}
            >
              <button
                type="button"
                onClick={() => selectItem(item.id)}
                aria-current={selected ? 'true' : undefined}
                class="flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-1 text-left hover:bg-black/[0.03] sm:w-auto sm:flex-1 dark:hover:bg-white/[0.04]"
              >
                <img
                  src={item.sourceUrl}
                  alt=""
                  class="size-11 shrink-0 rounded-lg border border-[var(--surface-border)] object-cover"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{item.file.name}</span>
                  <span class="block truncate text-xs text-[var(--muted)]">
                    {item.error ?? STATUS_LABEL[item.status]}
                  </span>
                </span>
              </button>

              <span
                class={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-block ${STATUS_STYLE[item.status]}`}
              >
                {STATUS_LABEL[item.status]}
              </span>

              <div class="ml-auto flex shrink-0 items-center gap-1">
                {item.status === 'done' && (
                  <button
                    type="button"
                    onClick={() => downloadItem(item.id)}
                    class="rounded-lg px-2 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-500/10 dark:text-teal-200"
                  >
                    Download
                  </button>
                )}

                <button
                  type="button"
                  disabled={item.status === 'processing'}
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.file.name}`}
                  class="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10"
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
