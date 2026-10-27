# Agent notes

## Product rules

1. Work phase by phase. Finish and verify a phase before starting the next.
2. Commit after each phase with conventional commits (`feat:`, `fix:`, `chore:`).
3. Before finishing a phase run typecheck, lint, and `npm run build`. Fix everything.
4. Do not add dependencies outside the stack below without a clear reason in the commit message.
5. No server code, analytics, trackers, or third-party requests except the model CDN.
6. Verify library APIs and model licenses against current docs and model cards. Do not rely on memory.
7. Keep the initial JS bundle small. The ML library and model load lazily, only when processing.
8. If blocked or a requirement conflicts with reality, stop and say so instead of guessing.
9. Never commit model files.

## Stack

Vite + TypeScript (strict), Preact + Tailwind CSS, `@huggingface/transformers` in a Web Worker
(WebGPU first, single-thread WASM fallback), `fflate` for ZIP, `vite-plugin-pwa`, Canvas API,
ESLint + Prettier, GitHub Actions to GitHub Pages.

## Commands

```bash
npm run dev
npm run build      # typecheck + vite build
npm run typecheck
npm run lint
npm test
npm run format
```

## Architecture

```
src/
  main.tsx, app.tsx
  components/  Dropzone, ModelLoader, Queue, Preview, Editor, Exporter, ThemeToggle, Footer
  workers/     inference.worker.ts
  lib/         model.ts, mask.ts, canvas.ts, zip.ts, device.ts
  state/       store.ts
  styles/
```

Data flow: file → ImageBitmap (EXIF-aware) → worker → model inference → mask → upscale mask to
original size → alpha composite → preview/editor → export.

## Constraints

- GitHub Pages cannot set COOP/COEP, so no SharedArrayBuffer / multi-thread WASM.
- Base path comes from `VITE_BASE` (default `/bg-remover/`). PWA scope must match.
- Output keeps the original resolution, capped at 4096px on the longest side to avoid OOM.
- Only permissively licensed models: BiRefNet Lite (MIT), MODNet (Apache-2.0).
