# Darkmintis BG Remover

Free, open-source background remover that runs entirely in your browser. Drop an image, get a
transparent PNG. No uploads, no signup, no watermark, no tracking.

**Live:** https://darkmintis.github.io/bg-remover/ (after first deploy)

## Why

Most background removers upload your images to a server. This one never does. The model is
downloaded once, cached by the browser, and runs locally with WebGPU (or WASM as a fallback).

## Features

- 100% client-side. Images never leave your device.
- Single image and bulk queue with ZIP export.
- Full-resolution output with a before/after preview.
- Brush editor for fixing edges, plus transparent, solid, blurred, or custom backgrounds.
- PNG, WebP, and JPG export.
- Installable PWA. Works offline after the app and model have been cached.
- Dark/light theme following the system by default.

## Privacy

There is no backend. The only network request is the one-time model download from the Hugging
Face CDN. No analytics, no trackers, no third-party requests.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173/bg-remover/
npm run build    # typecheck + production build
npm run preview  # serve the production build
npm run lint
npm test
```

The deploy base path is controlled by `VITE_BASE` and defaults to `/bg-remover/`.

## Models

| Tier    | Model                                                                     | License    |
| ------- | ------------------------------------------------------------------------- | ---------- |
| Fast    | [MODNet](https://huggingface.co/onnx-community/modnet-webnn)              | Apache-2.0 |
| Quality | [BiRefNet Lite](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX) | MIT        |

Model files are not stored in this repository; they are fetched from the Hugging Face CDN and
cached by Transformers.js.

## Contributing

Issues and pull requests are welcome. Run `npm run lint`, `npm run typecheck`, `npm test`, and
`npm run build` before opening a PR.

## License

MIT. See [LICENSE](./LICENSE).
