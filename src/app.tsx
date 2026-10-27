export function App() {
  return (
    <div class="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header class="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div class="flex items-center gap-2">
          <span class="grid size-9 place-items-center rounded-xl bg-emerald-500 text-white shadow-sm">
            <ScissorsIcon />
          </span>
          <span class="font-semibold tracking-tight">Darkmintis BG Remover</span>
        </div>
        <a
          class="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          href="https://github.com/Darkmintis/bg-remover"
        >
          GitHub
        </a>
      </header>

      <main class="mx-auto max-w-5xl px-4 pb-16">
        <section class="py-10 text-center sm:py-16">
          <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
            Remove backgrounds.
            <span class="block text-emerald-600 dark:text-emerald-400">Keep your privacy.</span>
          </h1>
          <p class="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-300">
            100% private. Runs on your device. Nothing is uploaded.
          </p>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p class="text-center text-sm text-slate-500 dark:text-slate-400">
            Dropzone coming in phase 4.
          </p>
        </section>
      </main>
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
