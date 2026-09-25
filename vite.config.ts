import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => ({
  define: mode === 'worker' ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') } : {},
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: '0.0.0.0', watch: { ignored: ['**/src-tauri/**', '**/output/**', '**/.playwright-cli/**'] } },
  envPrefix: ['VITE_'],
  build: { target: ['es2022', 'chrome105', 'safari15'] },
}));
