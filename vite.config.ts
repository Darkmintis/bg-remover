import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const base = env.VITE_BASE || '/bg-remover/';

  return {
    base,
    plugins: [preact(), tailwindcss()],
    build: {
      target: 'es2022',
    },
  };
});
