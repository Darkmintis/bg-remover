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

  return (
    <section
      aria-label="Upload images"
      onDragOver={(event) => {
        event.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      class={`surface text-center transition-[border-color,background,transform] duration-200 ${
        dragging ? 'dropzone-active' : ''
      } ${compact ? 'rounded-2xl border-dashed p-4' : 'rounded-[1.75rem] border-dashed p-8 sm:p-12'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        aria-label="Choose images"
        multiple
        class="sr-only"
        onChange={(event) => {
          pick(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />

      {compact ? (
        <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-[var(--muted)]">
          <span>Drop more images or paste, or</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            class="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            Choose images
          </button>
        </div>
      ) : (
        <>
          <div class="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-teal-400/20 to-cyan-400/10 text-teal-700 dark:text-teal-300">
            <UploadIcon />
          </div>
          <p class="text-lg font-semibold tracking-tight">Drop images here</p>
          <p class="mt-1 text-sm text-[var(--muted)]">
            or paste from the clipboard · JPG, PNG, WebP
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            class="btn-primary mt-6 rounded-xl px-6 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            Choose images
          </button>
          <p class="mt-4 text-xs text-[var(--muted)]">Nothing leaves your device.</p>
        </>
      )}
    </section>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      class="size-6"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 16V6" />
      <path d="m8 9 4-4 4 4" />
      <path d="M4 18h16" />
    </svg>
  );
}
