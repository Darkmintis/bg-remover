import { useCallback, useRef, useState } from 'preact/hooks';

interface PreviewProps {
  before: string;
  after: string;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function Preview({ before, after, width, height }: PreviewProps) {
  const [position, setPosition] = useState(50);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (rect.width <= 0) return;
    setPosition(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100));
  }, []);

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    dragging.current = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    updateFromClientX(event.clientX);
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging.current) return;
    updateFromClientX(event.clientX);
  }

  function onPointerUp(event: PointerEvent) {
    dragging.current = false;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
  }

  return (
    <div class="space-y-3">
      <div class="flex justify-center">
        <div
          ref={frameRef}
          role="slider"
          aria-label="Compare original and background-removed image"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          aria-valuetext={`${Math.round(position)}% original`}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              setPosition((value) => clamp(value - 2, 0, 100));
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              setPosition((value) => clamp(value + 2, 0, 100));
            } else if (event.key === 'Home') {
              event.preventDefault();
              setPosition(0);
            } else if (event.key === 'End') {
              event.preventDefault();
              setPosition(100);
            }
          }}
          class="checkerboard relative touch-none cursor-ew-resize overflow-hidden rounded-2xl border border-[var(--surface-border)] select-none"
          style={{
            aspectRatio: `${width} / ${height}`,
            width: `min(100%, calc(min(70vh, 720px) * ${width} / ${height}))`,
            maxHeight: 'min(70vh, 720px)',
          }}
        >
          {/* Transparent PNG sits on the checkerboard */}
          <img
            src={after}
            alt="Background removed"
            draggable={false}
            class="pointer-events-none absolute inset-0 size-full object-contain"
          />

          {/* Original clipped by vertical divider */}
          <div
            class="pointer-events-none absolute inset-0"
            style={{ clipPath: `inset(0 ${Math.max(0, 100 - position)}% 0 0)` }}
          >
            <img
              src={before}
              alt="Original"
              draggable={false}
              class="size-full object-contain"
            />
          </div>

          <div
            class="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-teal-400 shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
            style={{ left: `${position}%` }}
          >
            <span class="absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/80 bg-teal-600 text-white shadow-lg">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                class="size-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M8 6 4 12l4 6M16 6l4 6-4 6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>

      <p class="text-center text-xs text-[var(--muted)]">
        Drag across the image to compare · checkerboard means transparent
      </p>
    </div>
  );
}
