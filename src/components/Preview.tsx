import { useState } from 'preact/hooks';

interface PreviewProps {
  before: string;
  after: string;
  width: number;
  height: number;
}

export function Preview({ before, after, width, height }: PreviewProps) {
  const [position, setPosition] = useState(50);

  return (
    <div class="space-y-3">
      <div class="checkerboard relative mx-auto max-h-[70vh] w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <div class="relative mx-auto w-full" style={{ aspectRatio: `${width} / ${height}` }}>
          <img
            src={after}
            alt="Background removed"
            draggable={false}
            class="absolute inset-0 size-full object-contain"
          />
          <div
            class="absolute inset-0"
            style={{ clipPath: `inset(0 ${Math.max(0, 100 - position)}% 0 0)` }}
          >
            <img src={before} alt="Original" draggable={false} class="size-full object-contain" />
          </div>
          <div
            class="pointer-events-none absolute inset-y-0 w-0.5 bg-emerald-500 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
            style={{ left: `${position}%` }}
          />
        </div>
      </div>

      <div>
        <label class="block">
          <span class="sr-only">Compare original and background-removed image</span>
          <input
            type="range"
            min="0"
            max="100"
            value={position}
            onInput={(event) => setPosition(Number(event.currentTarget.value))}
            class="w-full accent-emerald-600"
          />
        </label>
        <div class="flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Before</span>
          <span>After</span>
        </div>
      </div>
    </div>
  );
}
