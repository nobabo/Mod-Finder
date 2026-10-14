import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('../../', import.meta.url)), test: { include: ['tooling/tests/**/*.test.{ts,mjs}'], testTimeout: 15000 } });
