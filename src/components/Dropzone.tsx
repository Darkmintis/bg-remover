import { useEffect, useRef, useState } from 'preact/hooks';
import { ACCEPTED_TYPES } from '../lib/files';

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  compact?: boolean;
}

export function Dropzone({ onFiles, busy = false, compact = false }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (busy) return;
      const items = event.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of items) {
        if (item.kind !== 'file') continue;
        const file = item.getAsFile();
        if (file) files.push(file);
      }

      if (files.length > 0) {
        event.preventDefault();
        onFiles(files);
      }
    }

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [busy, onFiles]);

  function pick(files: FileList | null) {
    if (!files || files.length === 0) return;
    onFiles(Array.from(files));
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!busy) pick(event.dataTransfer?.files ?? null);
  }

  const dragClass = dragging
    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
    : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900';

  return (
    <section
      aria-label="Upload images"
      onDragOver={(event) => {
        event.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      class={`border-2 border-dashed text-center transition-colors ${dragClass} ${
        compact ? 'rounded-2xl p-4' : 'rounded-3xl p-8 sm:p-12'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        class="sr-only"
        onChange={(event) => {
          pick(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />

      {compact ? (
        <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
          <span>Drop more images or paste here, or</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Choose images
          </button>
        </div>
      ) : (
        <>
          <p class="text-base font-semibold">Drop images here</p>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            or paste from the clipboard, or choose files
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            class="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Choose images
          </button>
          <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">
            JPG, PNG, or WebP. Nothing leaves your device.
          </p>
        </>
      )}
    </section>
  );
}
