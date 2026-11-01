import { defineConfig } from 'vite';

// base relative : le jeu fonctionne sous /nana-benz/ (GitHub Pages)
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
});
