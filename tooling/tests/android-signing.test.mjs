import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { secureSigningInvocation } from '../lib/android-signing.mjs';

const directories = [];
function setup(settings = { store: 'release.p12', alias: 'release', passwordDpapi: 'password.dpapi' }) {
  const directory = mkdtempSync(join(tmpdir(), 'modfinder-signing-test-'));
  directories.push(directory);
  const configPath = join(directory, 'android.json');
  writeFileSync(configPath, JSON.stringify(settings));
  writeFileSync(join(directory, 'release.p12'), '');
  writeFileSync(join(directory, 'password.dpapi'), '');
  return { root: resolve('.'), configPath, env: {}, platform: 'win32', nodeBinary: 'node' };
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    if (!resolve(directory).startsWith(resolve(tmpdir(), 'modfinder-signing-test-'))) throw new Error('Unsafe test cleanup path');
    rmSync(directory, { recursive: true, force: true });
  }
});
describe('protected Android signing handoff', () => {
  it('passes only paths and check mode to the protected child without mutating environment', () => {
    const input = setup();
    const args = secureSigningInvocation({ ...input, checkOnly: true });
    expect(args).toContain(join(input.root, 'tooling/scripts/with-android-signing.ps1'));
    expect(args).toContain(input.configPath);
    expect(args).toContain('-CheckOnly');
    expect(args).not.toContain('password.dpapi');
    expect(input.env).toEqual({});
  });
  it('keeps explicit signing environments and legacy settings on their existing paths', () => {
    const input = setup();
    expect(secureSigningInvocation({ ...input, env: { MODFINDER_KEY_ALIAS: 'explicit' } })).toBeNull();
    expect(secureSigningInvocation(setup({ store: 'release.p12', alias: 'release' }))).toBeNull();
    expect(secureSigningInvocation({ ...input, platform: 'linux' })).toBeNull();
  });
  it('rejects a password path outside the signing directory', () => {
    expect(() => secureSigningInvocation(setup({ store: 'release.p12', alias: 'release', passwordDpapi: '../outside.dpapi' }))).toThrow('must stay in the signing directory');
  });
  it('does not echo malformed private configuration data', () => {
    const input = setup();
    writeFileSync(input.configPath, '{invalid configuration');
    expect(() => secureSigningInvocation(input)).toThrow('Could not read Android signing configuration.');
  });
});
