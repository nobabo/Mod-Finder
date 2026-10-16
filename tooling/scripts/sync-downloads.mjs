import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeArtifactName } from '../lib/native-artifact.mjs';
import { APP_VERSION } from '../lib/version.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const platform = process.argv[2];
if (!['windows', 'android'].includes(platform) || process.argv.length !== 3) throw new Error('Usage: node tooling/scripts/sync-downloads.mjs windows|android');
const release = `v${APP_VERSION}`;
const fileName = nativeArtifactName(platform, APP_VERSION);
const local = await readFile(join(root, 'output/releases', release, fileName));
const sha256 = createHash('sha256').update(local).digest('hex');
const result = spawnSync('gh', ['release', 'view', release, '--repo', 'nobabo/Mod-Finder', '--json', 'isDraft,assets'], { encoding: 'utf8', shell: false, windowsHide: true });
if (result.error || result.status !== 0) throw new Error('Publish the release before synchronizing downloads.');
const metadata = JSON.parse(result.stdout);
if (metadata.isDraft || !metadata.assets.some(asset => asset.name === fileName && asset.size === local.length)) throw new Error('The public release does not contain the built artifact.');
// Verify the actual public bytes; GitHub URL parameters are not checksum validation.
const response = await fetch(`https://github.com/nobabo/Mod-Finder/releases/download/${release}/${fileName}`, { signal: AbortSignal.timeout(120000) });
if (!response.ok) throw new Error(`Public download: HTTP ${response.status}`);
const hash = createHash('sha256'); let size = 0;
for await (const chunk of response.body) { size += chunk.length; if (size > local.length) throw new Error('Published artifact size mismatch'); hash.update(chunk); }
if (size !== local.length || hash.digest('hex') !== sha256) throw new Error('Published artifact checksum mismatch');
const manifestPath = join(root, 'src/shared/data/app-downloads.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest[platform] = { ...manifest[platform], release, fileName, sha256 };
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Verified and synchronized ${fileName} (${sha256}).`);
