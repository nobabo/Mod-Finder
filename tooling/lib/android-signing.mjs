import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const names = ['MODFINDER_KEYSTORE_PATH', 'MODFINDER_KEYSTORE_PASSWORD', 'MODFINDER_KEY_ALIAS', 'MODFINDER_KEY_PASSWORD'];

// Decryption and the signed build stay in the child. No password is returned
// to Node on stdout, or included in a command argument.
export function secureSigningInvocation({ root, configPath, env, checkOnly = false, platform = process.platform, nodeBinary = process.execPath }) {
  if (platform !== 'win32' || names.some(name => env[name]?.trim()) || !existsSync(configPath)) return null;
  let settings;
  try { settings = JSON.parse(readFileSync(configPath, 'utf8')); }
  catch { throw new Error('Could not read Android signing configuration.'); }
  if (!settings.passwordDpapi) return null;
  if (settings.password || ['store', 'alias', 'passwordDpapi'].some(key => typeof settings[key] !== 'string' || !settings[key].trim())) {
    throw new Error('Invalid encrypted Android signing configuration.');
  }
  const directory = dirname(configPath);
  const passwordPath = resolve(directory, settings.passwordDpapi);
  const inside = relative(directory, passwordPath);
  if (isAbsolute(inside) || inside.split(/[\\/]/)[0] === '..') throw new Error('The encrypted password must stay in the signing directory.');
  if (!existsSync(passwordPath) || !existsSync(resolve(directory, settings.store))) throw new Error('Restore the encrypted Android signing files.');
  return ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'tooling/scripts/with-android-signing.ps1'),
    '-NodePath', nodeBinary, '-ConfigPath', configPath, ...(checkOnly ? ['-CheckOnly'] : [])];
}
