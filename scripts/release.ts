import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workerUrl = 'https://mod-finder.yjh802637.workers.dev';
const siteUrl = 'https://modfinder.pages.dev';
type Command = 'git' | 'npm' | 'wrangler' | 'node';
interface ReleaseTools {
  run: (command: Command, args: string[], quiet?: boolean) => string;
  fingerprint: () => string;
  verifyAssets: () => Promise<void>;
  log: (message: string) => void;
}

export async function release(checkOnly: boolean, message: string, tools: ReleaseTools) {
  const { run, fingerprint, verifyAssets, log } = tools;
  if (!checkOnly && !message.trim()) throw new Error('커밋 메시지를 입력하세요: npm run release -- "변경 내용"');
  if (run('git', ['branch', '--show-current'], true).trim() !== 'main') throw new Error('main 브랜치에서 실행하세요.');
  const remote = run('git', ['remote', 'get-url', 'origin'], true).trim();
  if (!['https://github.com/nobabo/Mod-Finder.git', 'git@github.com:nobabo/Mod-Finder.git'].includes(remote)) {
    throw new Error('origin이 Mod-Finder GitHub 저장소와 다릅니다.');
  }
  const syncRemote = () => {
    run('git', ['fetch', 'origin', 'main']);
    // Stop on a behind/diverged branch; never merge, rebase or force-push automatically.
    run('git', ['merge-base', '--is-ancestor', 'FETCH_HEAD', 'HEAD'], true);
  };
  syncRemote();
  run('git', ['diff', '--check']);
  run('git', ['diff', '--cached', '--check']);
  const initial = fingerprint();
  if (!checkOnly) run('wrangler', ['whoami']);
  log('타입·테스트·빌드·워커 실행을 검증합니다.');
  run('npm', ['run', 'typecheck']);
  run('npm', ['test']);
  run('npm', ['run', 'build']);
  // This builds dist in worker mode, packages it and exercises the Worker locally.
  run('npm', ['run', 'worker:verify']);
  if (fingerprint() !== initial) throw new Error('검증 중 파일 또는 스테이징 내용이 바뀌었습니다. 다시 실행하세요.');
  if (checkOnly) { log('검증 완료. 커밋·배포·푸시는 실행하지 않았습니다.'); return; }
  syncRemote();
  if (fingerprint() !== initial) throw new Error('검증 이후 파일이 바뀌었습니다. 다시 실행하세요.');
  if (run('git', ['status', '--porcelain'], true).trim()) {
    run('git', ['add', '--all', '--', '.']);
    run('git', ['commit', '-m', message]);
  }
  const commit = run('git', ['rev-parse', 'HEAD'], true).trim();
  const committed = fingerprint();
  const assertClean = () => {
    if (run('git', ['status', '--porcelain'], true).trim() || fingerprint() !== committed) {
      throw new Error('커밋 이후 작업 내용이 바뀌었습니다. 배포 상태를 확인하고 다시 실행하세요.');
    }
  };
  assertClean();
  log(`커밋 ${commit}을 워커에 배포합니다.`);
  run('wrangler', ['deploy', '--strict', '--keep-vars', '--message', commit]);
  log('워커 업로드 완료. 운영 검증 실패 시 배포는 이미 반영된 상태로 남습니다.');
  run('node', ['scripts/verify-deployment.mjs', workerUrl]);
  await verifyAssets();
  assertClean();
  syncRemote();
  assertClean();
  run('git', ['push', 'origin', `${commit}:refs/heads/main`]);
  const remoteCommit = run('git', ['ls-remote', 'origin', 'refs/heads/main'], true).split(/\s+/)[0];
  if (remoteCommit !== commit) throw new Error('원격 main이 배포한 커밋과 다릅니다. 원격 상태를 확인하세요.');
  log(`완료: ${siteUrl}\nGitHub 커밋: https://github.com/nobabo/Mod-Finder/commit/${commit}`);
}

function command(command: Command, args: string[], quiet = false) {
  let executable: string = command;
  let parameters = args;
  // Call JS entrypoints directly so Windows .cmd quoting cannot interpret the commit message.
  if (command === 'npm') {
    if (!process.env.npm_execpath) throw new Error('npm run release 또는 npm run release:check로 실행하세요.');
    executable = process.execPath; parameters = [process.env.npm_execpath, ...args];
  } else if (command === 'wrangler') {
    executable = process.execPath; parameters = [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), ...args];
  } else if (command === 'node') executable = process.execPath;
  const result = spawnSync(executable, parameters, {
    cwd: root, shell: false, windowsHide: true, encoding: 'utf8',
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit', maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args[0]} 실패 (종료 코드 ${result.status ?? result.signal}). ${quiet ? result.stderr?.trim() ?? '' : ''}`);
  return result.stdout ?? '';
}

function fingerprint() {
  const hash = createHash('sha256');
  hash.update(command('git', ['rev-parse', 'HEAD'], true));
  hash.update(command('git', ['diff', '--cached', '--binary'], true));
  const files = command('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], true).split('\0').filter(Boolean);
  for (const file of [...new Set(files)].sort()) {
    const name = file.split('/').at(-1)!;
    if ((/^\.env(?:\.|$)/.test(name) && name !== '.env.example') || /^\.dev\.vars(?:\.|$)/.test(name) || /\.(pem|key|p12|pfx|keystore|jks)$/i.test(name)) {
      throw new Error(`비밀 파일이 커밋 대상에 포함되어 있습니다: ${file}`);
    }
    hash.update(file + '\0');
    try { hash.update(readFileSync(resolve(root, file))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; hash.update('<deleted>'); }
    hash.update('\0');
  }
  return hash.digest('hex');
}

export async function waitForDeployment(check: () => Promise<void>, pause = () => new Promise(resolve => setTimeout(resolve, 5000))) {
  for (let attempt = 0; ; attempt++) {
    try { await check(); return; }
    catch (error) { if (attempt >= 5) throw error; await pause(); }
  }
}

async function verifyAssets() { await waitForDeployment(verifyAssetsOnce); }

async function verifyAssetsOnce() {
  const localHtml = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
  const assets = [...localHtml.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(match => match[1]);
  if (!assets.length) throw new Error('빌드 결과에서 검증할 자산을 찾지 못했습니다.');
  for (const base of [workerUrl, siteUrl]) {
    const response = await fetch(base, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!response.ok) throw new Error(`${base}: HTTP ${response.status}`);
    const html = await response.text();
    for (const asset of assets) {
      if (!html.includes(asset)) throw new Error(`${base}에 최신 빌드가 반영되지 않았습니다.`);
      const deployed = await fetch(new URL(asset, base), { signal: AbortSignal.timeout(15000) });
      if (!deployed.ok || !Buffer.from(await deployed.arrayBuffer()).equals(readFileSync(resolve(root, 'dist', asset.slice(1))))) {
        throw new Error(`${base}${asset}: 배포된 파일이 로컬 빌드와 다릅니다.`);
      }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let lock: string | undefined;
  try {
    const args = process.argv.slice(2);
    const checkOnly = args.length === 1 && args[0] === '--check';
    if (!checkOnly && (args.length !== 1 || args[0].startsWith('--'))) throw new Error('사용법: npm run release -- "커밋 메시지" 또는 npm run release:check');
    const lockPath = resolve(root, command('git', ['rev-parse', '--git-path', 'mod-finder-release.lock'], true).trim());
    closeSync(openSync(lockPath, 'wx'));
    lock = lockPath;
    await release(checkOnly, args[0], { run: command, fingerprint, verifyAssets, log: console.log });
  } catch (error) {
    console.error(`\n릴리스 중단: ${(error as Error).message}\n완료된 커밋·배포는 자동으로 되돌리지 않습니다. 원인을 해결한 뒤 같은 명령으로 다시 실행하세요.`);
    process.exitCode = 1;
  } finally { if (lock) unlinkSync(lock); }
}
