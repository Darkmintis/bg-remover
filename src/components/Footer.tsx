export function Footer() {
  return (
    <footer class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 border-t border-[var(--surface-border)] px-4 py-8 text-xs text-[var(--muted)]">
      <p>Open source · MIT · 100% client-side</p>
      <nav aria-label="Footer" class="flex gap-4">
        <a class="hover:text-[var(--ink)]" href="https://github.com/Darkmintis/bg-remover">
          GitHub
        </a>
        <a
          class="hover:text-[var(--ink)]"
          href="https://github.com/Darkmintis/bg-remover/blob/main/LICENSE"
        >
          License
        </a>
        <a class="hover:text-[var(--ink)]" href="https://github.com/Darkmintis/bg-remover/issues">
          Issues
        </a>
      </nav>
    </footer>
  );
}
