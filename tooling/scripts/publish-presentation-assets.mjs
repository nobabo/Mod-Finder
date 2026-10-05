import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve(process.argv[2] ?? 'output/발표용/모드파인더.html');
const publicDir = resolve('src/web/public');
const assetsDir = resolve(publicDir, 'presentation-assets');
mkdirSync(assetsDir, { recursive: true });
const assets = new Map();
function asset(contents, extension) {
  const data = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  const name = `${createHash('sha256').update(data).digest('hex').slice(0, 24)}.${extension}`;
  writeFileSync(resolve(assetsDir, name), data);
  assets.set(name, data.length);
  return `/presentation-assets/${name}`;
}
const extensions = { 'image/png': 'png', 'image/webp': 'webp', 'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf' };
let html = readFileSync(source, 'utf8').replace(/data:(image\/png|image\/webp|font\/woff2|font\/woff|font\/ttf);base64,([A-Za-z0-9+/=]+)/g,
  (_, mime, base64) => asset(Buffer.from(base64, 'base64'), extensions[mime]));
html = html.replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => `<link rel="stylesheet" href="${asset(css, 'css')}" />`);
html = html.replace(/<script>([\s\S]*?)<\/script>/g, (_, js) => `<script defer src="${asset(js, 'js')}"></script>`);
html = html.replace('<meta name="description" content="" />', '<meta name="description" content="" />\n    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />');
if (/<style>|<script>/.test(html) || /data:(?:image|font)\/[^;]+;base64,/.test(html)) throw new Error('Presentation still has an embedded resource');
if ([...assets.values()].some(size => size > 25 * 1024 * 1024)) throw new Error('Presentation asset exceeds the upload limit');
writeFileSync(resolve(publicDir, 'presentation.html'), html);
console.log(JSON.stringify({ source, slides: [...html.matchAll(/<section /g)].length, assetCount: assets.size, bytes: [...assets.values()].reduce((a, b) => a + b, Buffer.byteLength(html)) }));
