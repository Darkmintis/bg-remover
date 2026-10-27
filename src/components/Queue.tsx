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
  waiting: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  processing: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  done: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
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
    <section
      aria-label="Processing queue"
      class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold">Queue</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {done} of {items.length} done{failed > 0 ? ` · ${failed} failed` : ''}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          {state.running && (
            <button
              type="button"
              onClick={cancelQueue}
              class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          )}
          {!state.running && waiting > 0 && (
            <button
              type="button"
              onClick={startQueue}
              class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Resume
            </button>
          )}
          {failed > 0 && (
            <button
              type="button"
              onClick={retryFailed}
              class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Retry failed
            </button>
          )}
          {done > 0 && (
            <button
              type="button"
              disabled={zipping}
              onClick={handleZip}
              class="rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
            >
              {zipping ? 'Zipping…' : 'Download all (ZIP)'}
            </button>
          )}
          <button
            type="button"
            onClick={clearAll}
            class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Clear
          </button>
        </div>
      </div>

      <div class="mt-3" aria-hidden="true">
        <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            class="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <p class="sr-only" aria-live="polite">
        {finished} of {items.length} images finished.
      </p>

      <ul class="mt-3 max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
        {items.map((item) => {
          const selected = item.id === state.selectedId;
          return (
            <li
              key={item.id}
              class={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2 ${selected ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`}
            >
              <button
                type="button"
                onClick={() => selectItem(item.id)}
                aria-current={selected ? 'true' : undefined}
                class="flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-1 text-left hover:bg-slate-50 sm:w-auto sm:flex-1 dark:hover:bg-slate-800/60"
              >
                <img
                  src={item.sourceUrl}
                  alt=""
                  class="size-11 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{item.file.name}</span>
                  <span class="block truncate text-xs text-slate-500 dark:text-slate-400">
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
                    class="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950"
                  >
                    Download
                  </button>
                )}

                <button
                  type="button"
                  disabled={item.status === 'processing'}
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.file.name}`}
                  class="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
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
