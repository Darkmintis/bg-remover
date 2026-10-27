export function Footer() {
  return (
    <footer class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <p>
        Made by{' '}
        <a
          href="https://github.com/Darkmintis"
          class="font-semibold text-slate-700 hover:underline dark:text-slate-200"
        >
          Darkmintis
        </a>{' '}
        · MIT licensed
      </p>
      <nav aria-label="Footer" class="flex gap-4">
        <a
          class="hover:text-slate-900 dark:hover:text-white"
          href="https://github.com/Darkmintis/bg-remover"
        >
          GitHub
        </a>
        <a
          class="hover:text-slate-900 dark:hover:text-white"
          href="https://github.com/Darkmintis/bg-remover/blob/main/LICENSE"
        >
          License
        </a>
        <a
          class="hover:text-slate-900 dark:hover:text-white"
          href="https://github.com/Darkmintis/bg-remover/issues"
        >
          Issues
        </a>
      </nav>
    </footer>
  );
}
