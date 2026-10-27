import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { downloadBlob, outputName } from '../lib/files';
import { canvasPoint, clamp, coverRect } from '../lib/geometry';
import { applyEdit, type ImageItem } from '../state/store';

type Tool = 'restore' | 'erase' | 'pan';
type BackgroundMode = 'transparent' | 'solid' | 'blur' | 'custom';
type Format = 'png' | 'webp' | 'jpg';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  tool: 'restore' | 'erase';
  size: number;
  points: Point[];
}

interface EditorProps {
  item: ImageItem;
  onClose: () => void;
}

function drawDot(ctx: CanvasRenderingContext2D, stroke: Stroke, point: Point) {
  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === 'restore' ? 'source-over' : 'destination-out';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLine(ctx: CanvasRenderingContext2D, stroke: Stroke, from: Point, to: Point) {
  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === 'restore' ? 'source-over' : 'destination-out';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 1) {
    drawDot(ctx, stroke, stroke.points[0]);
    return;
  }
  for (let i = 1; i < stroke.points.length; i++) {
    drawLine(ctx, stroke, stroke.points[i - 1], stroke.points[i]);
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality = 1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode the image.'));
      },
      type,
      quality,
    );
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong in the editor.';
}

export function Editor({ item, onClose }: EditorProps) {
  const result = item.result;
  const width = result?.width ?? 1;
  const height = result?.height ?? 1;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const baseRef = useRef<ImageBitmap | null>(null);
  const baseMaskRef = useRef<ImageBitmap | null>(null);
  const customRef = useRef<ImageBitmap | null>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const panRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const rafRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('restore');
  const [brush, setBrush] = useState(48);
  const [background, setBackground] = useState<BackgroundMode>('transparent');
  const [color, setColor] = useState('#ffffff');
  const [blur, setBlur] = useState(24);
  const [customName, setCustomName] = useState('');
  const [customVersion, setCustomVersion] = useState(0);
  const [format, setFormat] = useState<Format>('png');
  const [quality, setQuality] = useState(0.9);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [display, setDisplay] = useState({ width: 0, height: 0 });
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redo, setRedo] = useState<Stroke[]>([]);
  const [saving, setSaving] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    const mask = maskRef.current;
    if (!canvas || !base || !mask) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);

    ctx.globalCompositeOperation = 'destination-over';
    if (background === 'solid') {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (background === 'blur') {
      const rect = coverRect(base.width, base.height, canvas.width, canvas.height);
      const margin = blur * 4;
      ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(
        base,
        rect.x - margin,
        rect.y - margin,
        rect.width + margin * 2,
        rect.height + margin * 2,
      );
      ctx.filter = 'none';
    } else if (background === 'custom' && customRef.current) {
      const image = customRef.current;
      const rect = coverRect(image.width, image.height, canvas.width, canvas.height);
      ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    }
    ctx.restore();
  }, [background, blur, color]);

  const scheduleDraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    let cancelled = false;
    if (!result) return;

    Promise.all([createImageBitmap(item.file), createImageBitmap(result.maskBlob)])
      .then(([base, mask]) => {
        if (cancelled) {
          base.close();
          mask.close();
          return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        baseRef.current = base;
        baseMaskRef.current = mask;
        canvas.width = result.width;
        canvas.height = result.height;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = result.width;
        maskCanvas.height = result.height;
        const maskContext = maskCanvas.getContext('2d');
        if (!maskContext) throw new Error('Canvas 2D is unavailable in this browser.');

        maskContext.drawImage(mask, 0, 0);
        maskRef.current = maskCanvas;
        setReady(true);
      })
      .catch((cause) => setError(errorMessage(cause)));

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      baseRef.current?.close();
      baseRef.current = null;
      baseMaskRef.current?.close();
      baseMaskRef.current = null;
      customRef.current?.close();
      customRef.current = null;
      maskRef.current = null;
    };
  }, [item, result]);

  useEffect(() => {
    if (ready) draw();
  }, [ready, draw, customVersion]);

  useEffect(() => {
    if (!ready) return;
    const area = areaRef.current;
    if (!area) return;

    const update = () => {
      const availableWidth = area.clientWidth;
      const availableHeight = area.clientHeight;
      if (!availableWidth || !availableHeight) return;
      const scale = Math.min(availableWidth / width, availableHeight / height);
      setDisplay({
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(area);
    return () => observer.disconnect();
  }, [height, ready, width]);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus({ preventScroll: true });

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (format === 'jpg' && background !== 'solid') setFormat('png');
  }, [background, format]);

  const replay = useCallback((nextStrokes: Stroke[]) => {
    const maskCanvas = maskRef.current;
    const baseMask = baseMaskRef.current;
    if (!maskCanvas || !baseMask) return;

    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    ctx.drawImage(baseMask, 0, 0);
    for (const stroke of nextStrokes) drawStroke(ctx, stroke);
    ctx.restore();
  }, []);

  const undo = useCallback(() => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    const next = strokes.slice(0, -1);
    setStrokes(next);
    setRedo((current) => [...current, last]);
    replay(next);
    scheduleDraw();
  }, [replay, scheduleDraw, strokes]);

  const redoAction = useCallback(() => {
    if (redo.length === 0) return;
    const last = redo[redo.length - 1];
    const next = [...strokes, last];
    setRedo(redo.slice(0, -1));
    setStrokes(next);
    replay(next);
    scheduleDraw();
  }, [redo, replay, scheduleDraw, strokes]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoAction();
        else undo();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, redoAction, undo]);

  function handlePointerDown(event: PointerEvent) {
    if (!ready) return;

    if (tool === 'pan' || event.button === 1) {
      event.preventDefault();
      panRef.current = {
        x: event.clientX,
        y: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      setPanning(true);
      canvasRef.current?.setPointerCapture(event.pointerId);
      return;
    }

    if (event.button !== 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const point = canvasPoint(
      event.clientX,
      event.clientY,
      canvas.getBoundingClientRect(),
      canvas.width,
      canvas.height,
    );
    const stroke: Stroke = {
      tool: tool === 'erase' ? 'erase' : 'restore',
      size: brush,
      points: [point],
    };
    strokeRef.current = stroke;

    const ctx = maskRef.current?.getContext('2d');
    if (ctx) drawDot(ctx, stroke, point);

    canvas.setPointerCapture(event.pointerId);
    scheduleDraw();
  }

  function handlePointerMove(event: PointerEvent) {
    if (panRef.current) {
      setPan({
        x: panRef.current.panX + event.clientX - panRef.current.x,
        y: panRef.current.panY + event.clientY - panRef.current.y,
      });
      return;
    }

    const stroke = strokeRef.current;
    const canvas = canvasRef.current;
    const ctx = maskRef.current?.getContext('2d');
    if (!stroke || !canvas || !ctx) return;

    const point = canvasPoint(
      event.clientX,
      event.clientY,
      canvas.getBoundingClientRect(),
      canvas.width,
      canvas.height,
    );
    const previous = stroke.points[stroke.points.length - 1];
    drawLine(ctx, stroke, previous, point);
    stroke.points.push(point);
    scheduleDraw();
  }

  function handlePointerUp(event: PointerEvent) {
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    if (panRef.current) {
      panRef.current = null;
      setPanning(false);
      return;
    }

    const stroke = strokeRef.current;
    if (stroke) {
      setStrokes((current) => [...current, stroke]);
      setRedo([]);
      strokeRef.current = null;
    }
  }

  async function loadCustom(file: File | undefined) {
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      customRef.current?.close();
      customRef.current = bitmap;
      setCustomName(file.name);
      setCustomVersion((current) => current + 1);
      setBackground('custom');
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function exportImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const actualFormat = format === 'jpg' && background !== 'solid' ? 'png' : format;
    const mime =
      actualFormat === 'png' ? 'image/png' : actualFormat === 'webp' ? 'image/webp' : 'image/jpeg';

    try {
      const blob = await canvasBlob(canvas, mime, quality);
      downloadBlob(blob, outputName(item.file.name, actualFormat));
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function apply() {
    const canvas = canvasRef.current;
    const maskCanvas = maskRef.current;
    if (!canvas || !maskCanvas) return;

    setSaving(true);
    try {
      const [resultBlob, maskBlob] = await Promise.all([
        canvasBlob(canvas, 'image/png'),
        canvasBlob(maskCanvas, 'image/png'),
      ]);
      applyEdit(item.id, {
        resultBlob,
        maskBlob,
        width: canvas.width,
        height: canvas.height,
      });
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  if (!result) return null;

  const toolClass =
    tool === 'pan' ? (panning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair';

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        tabIndex={-1}
        class="flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none sm:max-h-[95dvh] dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <header class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div class="min-w-0">
            <h2 id="editor-title" class="text-sm font-semibold">
              Edit result
            </h2>
            <p class="truncate text-xs text-slate-500 dark:text-slate-400">{item.file.name}</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              disabled={strokes.length === 0}
              onClick={undo}
              class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
            >
              Undo
            </button>
            <button
              type="button"
              disabled={redo.length === 0}
              onClick={redoAction}
              class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
            >
              Redo
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close editor"
              class="rounded-lg px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              ×
            </button>
          </div>
        </header>

        <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div
            ref={areaRef}
            class="checkerboard relative flex min-h-[40vh] shrink-0 items-center justify-center overflow-hidden lg:min-h-[60vh] lg:flex-1"
            onWheel={(event) => {
              event.preventDefault();
              setZoom((current) => clamp(current * (event.deltaY < 0 ? 1.1 : 0.9), 0.25, 8));
            }}
          >
            <canvas
              ref={canvasRef}
              aria-label="Mask editor canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              class={`touch-none select-none ${toolClass}`}
              style={{
                width: display.width ? `${display.width}px` : undefined,
                height: display.height ? `${display.height}px` : undefined,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center',
              }}
            />

            {!ready && !error && (
              <p class="absolute inset-0 grid place-items-center text-sm text-slate-600 dark:text-slate-300">
                Loading image…
              </p>
            )}
            {error && !ready && (
              <p
                role="alert"
                class="absolute inset-x-4 top-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
          </div>

          <aside class="min-h-0 w-full flex-1 space-y-5 overflow-y-auto border-t border-slate-200 p-4 lg:w-72 lg:flex-none lg:shrink-0 lg:border-t-0 lg:border-l dark:border-slate-800">
            <section>
              <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Brush</h3>
              <div class="mt-2 grid grid-cols-3 gap-1" role="group" aria-label="Editor tool">
                {(
                  [
                    ['restore', 'Restore'],
                    ['erase', 'Erase'],
                    ['pan', 'Pan'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={tool === value}
                    onClick={() => setTool(value)}
                    class={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                      tool === value
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label class="mt-3 block">
                <span class="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Brush size</span>
                  <span>{brush}px</span>
                </span>
                <input
                  type="range"
                  min="2"
                  max="160"
                  value={brush}
                  onInput={(event) => setBrush(Number(event.currentTarget.value))}
                  class="mt-1 w-full accent-emerald-600"
                />
              </label>
            </section>

            <section>
              <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Background
              </h3>
              <div class="mt-2 grid grid-cols-2 gap-1" role="group" aria-label="Background">
                {(
                  [
                    ['transparent', 'Transparent'],
                    ['solid', 'Color'],
                    ['blur', 'Blur'],
                    ['custom', 'Image'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={background === value}
                    onClick={() => setBackground(value)}
                    class={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                      background === value
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {background === 'solid' && (
                <label class="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>Color</span>
                  <input
                    type="color"
                    value={color}
                    onInput={(event) => setColor(event.currentTarget.value)}
                    class="h-8 w-12 rounded border border-slate-300 bg-transparent dark:border-slate-700"
                  />
                </label>
              )}

              {background === 'blur' && (
                <label class="mt-3 block">
                  <span class="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Blur</span>
                    <span>{blur}px</span>
                  </span>
                  <input
                    type="range"
                    min="2"
                    max="80"
                    value={blur}
                    onInput={(event) => setBlur(Number(event.currentTarget.value))}
                    class="mt-1 w-full accent-emerald-600"
                  />
                </label>
              )}

              {background === 'custom' && (
                <label class="mt-3 block">
                  <span class="text-xs text-slate-500 dark:text-slate-400">
                    {customName || 'Choose a background image'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void loadCustom(event.currentTarget.files?.[0])}
                    class="mt-1 block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold dark:text-slate-400 dark:file:bg-slate-800 dark:file:text-slate-200"
                  />
                </label>
              )}
            </section>

            <section>
              <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Export</h3>
              <div class="mt-2 grid grid-cols-3 gap-1" role="group" aria-label="Export format">
                {(['png', 'webp', 'jpg'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={format === value}
                    disabled={value === 'jpg' && background !== 'solid'}
                    onClick={() => setFormat(value)}
                    class={`rounded-lg px-2 py-1.5 text-xs font-semibold uppercase disabled:cursor-not-allowed disabled:opacity-40 ${
                      format === value
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>

              {(format === 'webp' || format === 'jpg') && (
                <label class="mt-3 block">
                  <span class="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Quality</span>
                    <span>{Math.round(quality * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={quality}
                    onInput={(event) => setQuality(Number(event.currentTarget.value))}
                    class="mt-1 w-full accent-emerald-600"
                  />
                </label>
              )}

              <button
                type="button"
                onClick={() => void exportImage()}
                class="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Download {format.toUpperCase()}
              </button>

              {error && ready && (
                <p role="alert" class="mt-2 text-xs text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              <p class="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                JPG needs a solid background. PNG and WebP keep transparency.
              </p>
            </section>
          </aside>
        </div>

        <footer class="flex flex-col gap-2 border-t border-slate-200 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4 sm:py-3 dark:border-slate-800">
          <div class="flex items-center justify-center gap-1 text-xs text-slate-500 sm:justify-start dark:text-slate-400">
            <button
              type="button"
              onClick={() => setZoom((current) => clamp(current * 0.8, 0.25, 8))}
              aria-label="Zoom out"
              class="rounded-lg border border-slate-300 px-2 py-1 font-semibold dark:border-slate-700"
            >
              −
            </button>
            <span class="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((current) => clamp(current * 1.25, 0.25, 8))}
              aria-label="Zoom in"
              class="rounded-lg border border-slate-300 px-2 py-1 font-semibold dark:border-slate-700"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              class="ml-1 rounded-lg border border-slate-300 px-2 py-1 font-semibold dark:border-slate-700"
            >
              Fit
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={onClose}
              class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void apply()}
              class="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Apply & close'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
