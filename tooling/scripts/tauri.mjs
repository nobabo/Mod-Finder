import { run } from '@tauri-apps/cli';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(root);
process.env.TAURI_APP_PATH = fileURLToPath(new URL('../../src/native', import.meta.url));
process.env.TAURI_FRONTEND_PATH = root;
process.env.CARGO_TARGET_DIR ??= fileURLToPath(new URL('../../output/native', import.meta.url));

try { await run(process.argv.slice(2), 'npm run tauri --'); }
catch (error) { console.error(error.message); process.exitCode = 1; }
