import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { cpSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL('../../src/web', import.meta.url)),
  envDir: root,
  define: mode === 'worker' ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') } : {},
  publicDir: mode === 'native' ? false : undefined,
  plugins: [react(), ...(mode === 'native' ? [{
    name: 'native-public-assets',
    writeBundle() {
      const publicDir = join(root, 'src/web/public');
      for (const file of readdirSync(publicDir)) {
        if (['presentation.html', 'presentation-assets', '_headers', '_redirects'].includes(file)) continue;
        cpSync(join(publicDir, file), join(root, 'output/web', file), { recursive: true });
      }
    },
  }] : [])],
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: '0.0.0.0', watch: { ignored: ['**/src/native/**', '**/output/**', '**/.playwright-cli/**'] } },
  envPrefix: ['VITE_'],
  build: { outDir: fileURLToPath(new URL('../../output/web', import.meta.url)), emptyOutDir: true, target: ['es2022', 'chrome105', 'safari15'] },
}));
