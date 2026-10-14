import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const destination = join(root, 'src/web/public/fonts');
const families = ['Chiron+GoRound+TC:wght@200..900', 'Noto+Sans+KR:wght@400..800', 'Kulim+Park:wght@400;600;700', 'Noto+Sans+JP:wght@400..800', 'Noto+Sans+SC:wght@400..800'];
const source = `https://fonts.googleapis.com/css2?${families.map(family => `family=${family}`).join('&')}&display=swap`;
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' };
async function download(url, limit) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${new URL(url).hostname}: HTTP ${response.status}`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error('Font response exceeds limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
await mkdir(destination, { recursive: true });
let css = (await download(source, 512 * 1024)).toString('utf8');
const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.(?:woff2|ttf))\)/g)].map(match => match[1]))];
if (!urls.length) throw new Error('No font subsets found');
const manifest = [];
let index = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (index < urls.length) {
    const url = urls[index++];
    const bytes = await download(url, 2 * 1024 * 1024);
    const extension = url.endsWith('.woff2') ? 'woff2' : 'ttf';
    if (extension === 'woff2' ? bytes.subarray(0, 4).toString() !== 'wOF2' : bytes.readUInt32BE(0) !== 0x00010000) throw new Error('Invalid font file');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const file = `${sha256.slice(0, 20)}.${extension}`;
    await writeFile(join(destination, file), bytes);
    manifest.push({ url, file, sha256, bytes: bytes.length });
  }
}));
for (const entry of manifest) css = css.replaceAll(entry.url, `/fonts/${entry.file}`);
if (/https?:\/\//.test(css)) throw new Error('Font stylesheet contains a remote reference');
for (const family of ['chirongoroundtc', 'notosanskr', 'kulimpark', 'notosansjp', 'notosanssc']) {
  const license = await download(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`, 32 * 1024);
  await writeFile(join(destination, `${family}-OFL.txt`), license);
}
await writeFile(join(destination, 'fonts.css'), css);
await writeFile(join(destination, 'sources.json'), JSON.stringify({ source, fonts: manifest.sort((a, b) => a.file.localeCompare(b.file)) }, null, 2) + '\n');
console.log(`Vendored ${manifest.length} font subsets (${(manifest.reduce((sum, entry) => sum + entry.bytes, 0) / 1024 / 1024).toFixed(1)} MiB).`);
const compression = spawnSync(process.env.MODFINDER_FONT_PYTHON || 'python', [join(root, 'tooling/scripts/compress-fonts.py')], { stdio: 'inherit', windowsHide: true });
if (compression.error || compression.status !== 0) throw new Error('Install tooling/fonts-requirements.txt in Python before refreshing fonts.');
