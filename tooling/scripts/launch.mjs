import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
const mode = process.argv[2];
const verifyOnly = process.argv.includes('--verify');
const api = 'http://127.0.0.1:4318';
const web = 'http://localhost:1420';
const owned = new Set();
let stopping = false;

function start(label, executable, args, extraEnv = {}) {
  console.log(`[Mod Finder] Starting ${label}...`);
  const child = spawn(executable, args, {
    cwd: root, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, ...extraEnv },
  });
  owned.add(child);
  child.once('error', error => {
    console.error(`[Mod Finder] ${label}: ${error.message}`);
    void stop(1);
  });
  child.once('exit', code => {
    owned.delete(child);
    if (stopping) return;
    if (label === 'Tauri') void stop(code ?? 1);
    else {
      console.error(`[Mod Finder] ${label} stopped. Close the launcher and try again.`);
      void stop(1);
    }
  });
  return child;
}

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  // Only terminate processes started by this launcher, never reused services.
  await Promise.all([...owned].map(child => new Promise(done => {
    if (!child.pid || child.exitCode !== null) return done();
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
      killer.once('error', done); killer.once('exit', done);
    } else {
      child.kill('SIGTERM'); child.once('exit', done);
    }
  })));
  process.exitCode = code;
  process.stdin.pause();
}

async function probe(url, valid) {
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(1500) }); }
  catch { return false; }
  if (!response.ok || !(await valid(response))) {
    throw new Error(`Another service is using ${url}. Close that service or change its port.`);
  }
  return true;
}

async function ensure(label, url, valid, cli, args, env = {}) {
  if (await probe(url, valid)) {
    console.log(`[Mod Finder] Reusing ${label}: ${url}`);
    return;
  }
  start(label, process.execPath, [resolve(root, cli), ...args], env);
  for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
    await delay(500);
    if (await probe(url, valid)) return;
  }
  throw new Error(`${label} did not become ready. Check the messages above.`);
}

process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
process.once('SIGHUP', () => void stop());

try {
  if (!['web', 'tauri'].includes(mode)) throw new Error('Expected web or tauri launcher mode.');
  for (const file of ['node_modules/tsx/dist/cli.mjs', 'node_modules/vite/bin/vite.js', ...(mode === 'tauri' ? ['node_modules/@tauri-apps/cli/tauri.js'] : [])]) {
    if (!existsSync(resolve(root, file))) throw new Error('Dependencies are missing. Run npm ci in the project folder first.');
  }
  await ensure('API', `${api}/health`, async r => {
    const data = await r.json(); return data.ok === true && data.version === '0.1.0';
  }, 'node_modules/tsx/dist/cli.mjs', ['watch', 'src/server/main.ts'], { HOST: '127.0.0.1', PORT: '4318' });
  await ensure('Web UI', web, async r => (await r.text()).includes('<title>Mod Finder'),
    'node_modules/vite/bin/vite.js', ['--config', 'tooling/config/vite.config.ts', '--host', '127.0.0.1', '--port', '1420', '--strictPort'], { VITE_API_BASE_URL: api });
  if (verifyOnly) {
    console.log(`[Mod Finder] ${mode} launcher checks passed. No app window opened.`);
    await stop();
  } else {
    if (mode === 'tauri') {
      start('Tauri', process.execPath, [resolve(root, 'tooling/scripts/tauri.mjs'), 'dev', '--config', resolve(root, 'tooling/config/tauri-launcher.json')], { VITE_API_BASE_URL: api });
    } else {
      const opener = spawn('cmd.exe', ['/d', '/c', 'start', '', web], { windowsHide: true, stdio: 'ignore' });
      opener.once('error', () => console.log(`[Mod Finder] Open ${web} in your browser.`));
    }
    console.log('[Mod Finder] Keep this window open. Press Ctrl+C to stop services started here.');
    process.stdin.resume();
  }
} catch (error) {
  console.error(`[Mod Finder] ${error.message}`);
  await stop(1);
}
