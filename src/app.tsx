import { useEffect, useState } from 'preact/hooks';
import { Dropzone } from './components/Dropzone';
import { Editor } from './components/Editor';
import { Footer } from './components/Footer';
import { InstallPrompt } from './components/InstallPrompt';
import { ModelLoader } from './components/ModelLoader';
import { Preview } from './components/Preview';
import { Queue } from './components/Queue';
import { ThemeToggle } from './components/ThemeToggle';
import { MAX_SIDE } from './lib/model';
import {
  addFiles,
  downloadItem,
  initStore,
  removeItem,
  retryFailed,
  startQueue,
  useStore,
} from './state/store';

export function App() {
  const state = useStore();
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const selected =
    state.items.find((item) => item.id === state.selectedId) ?? state.items[0] ?? null;
  const editingItem = state.items.find(
    (item) => item.id === editingId && item.status === 'done' && item.result,
  );
  const hasItems = state.items.length > 0;
  const failedNeedsBrush =
    selected?.status === 'failed' &&
    /could not auto-remove|brush|quality model/i.test(selected.error ?? '');

  useEffect(initStore, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
      if (editingId || !selected || selected.status !== 'done') return;

      event.preventDefault();
      downloadItem(selected.id);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingId, selected]);

  function handleFiles(files: File[]) {
    const { rejected } = addFiles(files);
    setNotice(rejected.length > 0 ? rejected.join(' ') : null);
  }

  return (
    <div class="app-shell text-[var(--ink)]">
      <div class="app-aurora" aria-hidden="true" />

      <header class="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div class="flex items-center gap-3">
          <span class="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-700 text-white shadow-[0_10px_30px_-12px_var(--mint-glow)]">
            <ScissorsIcon />
          </span>
          <p class="text-base font-semibold tracking-tight">BG Remover</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <InstallPrompt />
          <ThemeToggle />
          <a
            aria-label="GitHub repository"
            title="GitHub repository"
            class="btn-ghost grid size-9 place-items-center rounded-xl"
            href="https://github.com/Darkmintis/bg-remover"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" class="size-4" fill="currentColor">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
          </a>
        </div>
      </header>

      <main class="mx-auto max-w-5xl px-4 pb-20">
        {!hasItems && (
          <section class="animate-rise py-8 text-center sm:py-14">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700 dark:text-teal-300">
              Free · Private · Local
            </p>
            <h1 class="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
              <span class="bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent dark:from-teal-300 dark:to-cyan-300">
                BG Remover
              </span>
            </h1>
            <p class="mx-auto mt-4 max-w-lg text-base text-[var(--muted)] sm:text-lg">
              Drop a photo. Get a clean cutout. Runs on your device - nothing is uploaded.
            </p>
          </section>
        )}

        <div class={`space-y-4 ${hasItems ? 'pt-2' : ''}`}>
          <div class="animate-rise-delay">
            <Dropzone onFiles={handleFiles} compact={hasItems} />
          </div>

          <ModelLoader />

          {notice && (
            <p
              role="status"
              class="surface animate-rise rounded-2xl px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
            >
              {notice}
            </p>
          )}

          <Queue />

          {selected && selected.status === 'waiting' && (
            <section class="surface animate-rise rounded-3xl p-6 text-center">
              <h2 class="truncate text-sm font-semibold">{selected.file.name}</h2>
              <p class="mt-1 text-xs text-[var(--muted)]">Waiting in the queue.</p>
              {!state.running && (
                <button
                  type="button"
                  onClick={startQueue}
                  class="btn-primary mt-4 rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  Resume queue
                </button>
              )}
            </section>
          )}

          {selected && selected.status === 'processing' && (
            <section
              aria-live="polite"
              class="surface animate-rise overflow-hidden rounded-3xl p-4 text-center"
            >
              <div class="mx-auto flex max-h-80 justify-center overflow-hidden rounded-2xl">
                <div class="checkerboard inline-flex max-h-80 max-w-full items-center justify-center rounded-2xl">
                  <img
                    src={selected.sourceUrl}
                    alt={`Processing ${selected.file.name}`}
                    class="max-h-80 w-auto max-w-full object-contain opacity-55"
                  />
                </div>
              </div>
              <div class="mt-4 flex items-center justify-center gap-2 text-sm font-semibold">
                <span class="size-2 animate-pulse rounded-full bg-teal-500" />
                Removing the background…
              </div>
              <p class="mt-1 text-xs text-[var(--muted)]">
                First run downloads the model once. Your UI stays responsive.
              </p>
            </section>
          )}

          {selected && selected.status === 'failed' && (
            <section class="surface animate-rise rounded-3xl border-red-200/70 p-6 text-center dark:border-red-900/50">
              <h2 class="text-base font-semibold">
                {failedNeedsBrush ? 'Couldn’t auto-remove this background' : 'Couldn’t remove the background'}
              </h2>
              <p class="mt-1 truncate text-xs text-[var(--muted)]">{selected.file.name}</p>
              <p class="mx-auto mt-2 max-w-xl text-sm text-red-700 dark:text-red-300">
                {selected.error}
              </p>
              {failedNeedsBrush && (
                <p class="mx-auto mt-2 max-w-xl text-sm text-[var(--muted)]">
                  Tip: switch to Quality and retry, or download isn’t possible until a cutout exists.
                  For tough edges, process with Quality then use Edit → brush to restore.
                </p>
              )}
              <div class="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={retryFailed}
                  class="btn-primary rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(selected.id)}
                  class="btn-ghost rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  Remove
                </button>
              </div>
            </section>
          )}

          {selected && selected.status === 'done' && selected.result && selected.resultUrl && (
            <section class="surface animate-rise rounded-3xl p-4 sm:p-6">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="truncate text-sm font-semibold">{selected.file.name}</h2>
                  <p class="text-xs text-[var(--muted)]">
                    {selected.result.width} × {selected.result.height} px · transparent PNG · local
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(selected.id)}
                    class="btn-ghost rounded-xl px-4 py-2 text-sm font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadItem(selected.id)}
                    aria-keyshortcuts="Control+S Meta+S"
                    title="Download PNG (Ctrl+S)"
                    class="btn-primary rounded-xl px-4 py-2 text-sm font-semibold"
                  >
                    Download PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(selected.id)}
                    class="btn-ghost rounded-xl px-4 py-2 text-sm font-semibold"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <Preview
                before={selected.sourceUrl}
                after={selected.resultUrl}
                width={selected.result.width}
                height={selected.result.height}
              />

              {selected.result.resized && (
                <p class="mt-3 rounded-xl bg-black/5 px-3 py-2 text-xs text-[var(--muted)] dark:bg-white/5">
                  This image was larger than {MAX_SIDE}px, so it was scaled down before processing
                  to keep memory use in check.
                </p>
              )}
            </section>
          )}
        </div>
      </main>

      <Footer />

      {editingItem && <Editor item={editingItem} onClose={() => setEditingId(null)} />}
    </div>
  );
}

function ScissorsIcon() {
  return (
    <svg
      aria-hidden="true"
      class="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" />
    </svg>
  );
}
