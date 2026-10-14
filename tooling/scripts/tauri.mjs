import { run } from '@tauri-apps/cli';
import { fileURLToPath } from 'node:url';
import { nativeSecurityConfig } from '../lib/native-config.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(root);
process.env.TAURI_APP_PATH = fileURLToPath(new URL('../../src/native', import.meta.url));
process.env.TAURI_FRONTEND_PATH = root;
process.env.CARGO_TARGET_DIR ??= fileURLToPath(new URL('../../output/native', import.meta.url));

try {
  const args = process.argv.slice(2);
  if (args[0] === 'build') {
    process.env.VITE_API_BASE_URL ||= 'https://modfinder.pages.dev';
    args.push('--config', JSON.stringify(nativeSecurityConfig(process.env.VITE_API_BASE_URL)));
  }
  await run(args, 'npm run tauri --');
}
catch (error) { console.error(error.message); process.exitCode = 1; }
