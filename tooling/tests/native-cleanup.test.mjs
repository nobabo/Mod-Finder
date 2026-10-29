import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const available = spawnSync('pwsh', ['-NoProfile', '-Command', 'exit 0'], { windowsHide: true }).status === 0;
const fixtures = [];
function fixture() {
  mkdirSync('output', { recursive: true });
  const root = mkdtempSync(resolve('output/native-cleanup-test-'));
  fixtures.push(root);
  const put = (path, text = 'keep me') => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  put('package.json', '{"name":"mod-finder"}');
  put('tooling/scripts/clean-native.ps1', '');
  copyFileSync('tooling/scripts/clean-native.ps1', join(root, 'tooling/scripts/clean-native.ps1'));
  put('output/native/release/bundle/nsis/old-setup.exe');
  put('output/native/debug/cache.bin', 'generated cache');
  put('output/android/gradle/app/reports/test.html');
  put('output/android/avd/snapshots/default_boot/ram.img');
  put('output/android/avd/userdata-qemu.img');
  put('output/releases/v0.2.4/installer.exe');
  put('src/android/Source.kt');
  return { root, put, run: (...args) => spawnSync('pwsh', ['-NoProfile', '-File', join(root, 'tooling/scripts/clean-native.ps1'), ...args], { encoding: 'utf8', windowsHide: true }) };
}
afterEach(() => { for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe.skipIf(!available)('native generated-file cleanup', () => {
  it('previews without removing files or creating an archive', () => {
    const { root, run } = fixture();
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Preview only');
    expect(existsSync(join(root, 'output/native/debug/cache.bin'))).toBe(true);
    expect(existsSync(join(root, 'output/archive'))).toBe(false);
  });
  it('verifies artifacts before removal and preserves sources, release copies and AVD data', () => {
    const { root, run } = fixture();
    const result = run('-Apply');
    expect(result.status, result.stderr).toBe(0);
    const archives = readdirSync(join(root, 'output/archive'));
    expect(archives).toHaveLength(1);
    const archive = join(root, 'output/archive', archives[0]);
    const manifest = JSON.parse(readFileSync(join(archive, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
    expect(manifest.targets.every(entry => entry.removed)).toBe(true);
    expect(manifest.preserved).toHaveLength(2);
    for (const entry of manifest.preserved) {
      expect(createHash('sha256').update(readFileSync(join(archive, entry.path))).digest('hex')).toBe(entry.sha256);
    }
    for (const path of ['output/native', 'output/android/gradle', 'output/android/avd/snapshots']) expect(existsSync(join(root, path))).toBe(false);
    for (const path of ['src/android/Source.kt', 'output/releases/v0.2.4/installer.exe', 'output/android/avd/userdata-qemu.img']) expect(readFileSync(join(root, path), 'utf8')).toBe('keep me');
    expect(run('-Apply').status).toBe(0);
    expect(readdirSync(join(root, 'output/archive'))).toEqual(archives);
  });
  it('refuses a junction inside a cleanup target before modifying any files', () => {
    const { root, put, run } = fixture();
    put('outside/important.txt');
    symlinkSync(join(root, 'outside'), join(root, 'output/native/linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = run('-Apply');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Linked directory');
    expect(readFileSync(join(root, 'outside/important.txt'), 'utf8')).toBe('keep me');
    expect(existsSync(join(root, 'output/native/debug/cache.bin'))).toBe(true);
    expect(existsSync(join(root, 'output/archive'))).toBe(false);
  });
});
