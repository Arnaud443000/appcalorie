import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, type Plugin } from 'vitest/config';

// Sur GitHub Pages l'app est servie sous /<nom-du-dépôt>/ : le workflow fournit BASE_PATH.
const base = process.env.BASE_PATH ?? '/';

// Les couleurs du manifeste et de la barre iOS viennent du fichier de tokens (source unique).
const tokens = readFileSync(new URL('./src/ui/tokens.css', import.meta.url), 'utf8');
function token(name: string): string {
  const value = new RegExp(`${name}:\\s*([^;]+);`).exec(tokens)?.[1];
  if (!value) throw new Error(`Token ${name} introuvable dans src/ui/tokens.css`);
  return value.trim();
}
const themeColor = token('--color-bg');

const injectThemeColor: Plugin = {
  name: 'atlas-theme-color',
  transformIndexHtml: (html) => html.replaceAll('%ATLAS_THEME_COLOR%', themeColor),
};

export default defineConfig({
  base,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    injectThemeColor,
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Atlas Muscu',
        short_name: 'Atlas Muscu',
        description: 'Musculation et nutrition, au quotidien.',
        lang: 'fr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: themeColor,
        theme_color: themeColor,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
