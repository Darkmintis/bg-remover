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
  infer,
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
    <div class="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header class="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div class="flex items-center gap-2">
          <span class="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <ScissorsIcon />
          </span>
          <span class="whitespace-nowrap font-semibold tracking-tight">
            <span class="hidden sm:inline">Darkmintis </span>BG Remover
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <InstallPrompt />
          <ThemeToggle />
          <a
            aria-label="GitHub repository"
            title="GitHub repository"
            class="grid size-9 place-items-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            href="https://github.com/Darkmintis/bg-remover"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" class="size-4" fill="currentColor">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
          </a>
        </div>
      </header>

      <main class="mx-auto max-w-5xl px-4 pb-16">
        <section class="py-10 text-center sm:py-16">
          <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
            Remove backgrounds.
            <span class="block text-emerald-700 dark:text-emerald-400">Keep your privacy.</span>
          </h1>
          <p class="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-300">
            100% private. Runs on your device. Nothing is uploaded.
          </p>
        </section>

        <div class="space-y-4">
          <ModelLoader />

          {notice && (
            <p
              role="status"
              class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
            >
              {notice}
            </p>
          )}

          <Dropzone onFiles={handleFiles} compact={state.items.length > 0} />

          <Queue />

          {selected && selected.status === 'waiting' && (
            <section class="rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 class="truncate text-sm font-semibold">{selected.file.name}</h2>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Waiting in the queue.</p>
              {!state.running && (
                <button
                  type="button"
                  onClick={startQueue}
                  class="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Resume queue
                </button>
              )}
            </section>
          )}

          {selected && selected.status === 'processing' && (
            <section
              aria-live="polite"
              class="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div class="checkerboard mx-auto grid max-h-80 place-items-center overflow-hidden rounded-2xl">
                <img
                  src={selected.sourceUrl}
                  alt={`Processing ${selected.file.name}`}
                  class="max-h-80 w-auto opacity-60"
                />
              </div>
              <div class="mt-4 flex items-center justify-center gap-2 text-sm font-medium">
                <span class="size-2 animate-pulse rounded-full bg-emerald-500" />
                Removing the background…
              </div>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                The first run also downloads the model. The UI stays responsive.
              </p>
            </section>
          )}

          {selected && selected.status === 'failed' && (
            <section class="rounded-3xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900 dark:bg-slate-900">
              <h2 class="text-base font-semibold">Couldn’t remove the background</h2>
              <p class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {selected.file.name}
              </p>
              <p class="mx-auto mt-2 max-w-xl text-sm text-red-700 dark:text-red-300">
                {selected.error}
              </p>
              <div class="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={retryFailed}
                  class="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(selected.id)}
                  class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Remove
                </button>
              </div>
            </section>
          )}

          {selected && selected.status === 'done' && selected.result && selected.resultUrl && (
            <section class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="truncate text-sm font-semibold">{selected.file.name}</h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {selected.result.width} × {selected.result.height} px · processed locally
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(selected.id)}
                    class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadItem(selected.id)}
                    aria-keyshortcuts="Control+S Meta+S"
                    title="Download PNG (Ctrl+S)"
                    class="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Download PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(selected.id)}
                    class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
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
                <p class="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  This image was larger than {MAX_SIDE}px, so it was scaled down before processing
                  to keep memory use in check.
                </p>
              )}
            </section>
          )}

          {import.meta.env.DEV && <DevModelTest />}
        </div>
      </main>

      <Footer />

      {editingItem && <Editor item={editingItem} onClose={() => setEditingId(null)} />}
    </div>
  );
}

function DevModelTest() {
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<{ result: string; mask: string } | null>(null);

  useEffect(() => {
    return () => {
      if (output) {
        URL.revokeObjectURL(output.result);
        URL.revokeObjectURL(output.mask);
      }
    };
  }, [output]);

  async function run() {
    setBusy(true);
    try {
      const blob = await makeTestImage();
      const result = await infer(blob);

      if (output) {
        URL.revokeObjectURL(output.result);
        URL.revokeObjectURL(output.mask);
      }

      setOutput({
        result: URL.createObjectURL(result.resultBlob),
        mask: URL.createObjectURL(result.maskBlob),
      });
    } catch {
      // The model loader surfaces the error.
    } finally {
      setBusy(false);
    }
  }

  return (
    <section class="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
      <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Dev: model test</h2>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        class="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
      >
        {busy ? 'Processing…' : 'Run synthetic inference test'}
      </button>
      {output && (
        <div class="mt-3 grid grid-cols-2 gap-3">
          <div class="checkerboard overflow-hidden rounded-lg">
            <img src={output.result} alt="Test result with transparency" class="block w-full" />
          </div>
          <img
            src={output.mask}
            alt="Test mask"
            class="rounded-lg bg-slate-200 dark:bg-slate-800"
          />
        </div>
      )}
    </section>
  );
}

async function makeTestImage(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Canvas unavailable');

  const gradient = ctx.createLinearGradient(0, 0, 768, 512);
  gradient.addColorStop(0, '#0f766e');
  gradient.addColorStop(1, '#f59e0b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 768, 512);

  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.ellipse(384, 260, 150, 180, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.ellipse(384, 120, 60, 26, -0.3, 0, Math.PI * 2);
  ctx.fill();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode test image'));
    }, 'image/png');
  });
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
