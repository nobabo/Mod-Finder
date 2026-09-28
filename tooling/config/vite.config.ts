import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL('../../src/web', import.meta.url)),
  envDir: root,
  define: mode === 'worker' ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') } : {},
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: '0.0.0.0', watch: { ignored: ['**/src/native/**', '**/output/**', '**/.playwright-cli/**'] } },
  envPrefix: ['VITE_'],
  build: { outDir: fileURLToPath(new URL('../../output/web', import.meta.url)), emptyOutDir: true, target: ['es2022', 'chrome105', 'safari15'] },
}));
