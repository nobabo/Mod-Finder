import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const options = ['--config', resolve(root, 'tooling/config/wrangler.jsonc')];
// Wrangler resolves dev secrets beside its config. Keep the shared .env at the project root.
if (['dev', 'types'].includes(args[0]) && !args.some(arg => arg === '--env-file' || arg.startsWith('--env-file='))) {
  const envIndex = args.findIndex(arg => arg === '--env' || arg === '-e');
  const environment = args.find(arg => arg.startsWith('--env='))?.slice(6) ?? (envIndex >= 0 ? args[envIndex + 1] : undefined);
  const suffix = environment ? `.${environment}` : '';
  const devVars = [`.dev.vars${suffix}`, '.dev.vars'].find(name => existsSync(resolve(root, name)));
  const files = devVars ? [devVars] : ['.env', '.env.local', ...(suffix ? [`.env${suffix}`, `.env${suffix}.local`] : [])];
  for (const name of files) if (existsSync(resolve(root, name))) options.push('--env-file', resolve(root, name));
}
const child = spawn(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), ...args, ...options], {
  cwd: root, stdio: 'inherit', windowsHide: true,
});
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
