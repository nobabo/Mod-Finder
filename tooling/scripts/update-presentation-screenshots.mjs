import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourceDir = resolve(root, 'docs/제출용/presentation');
const publicDir = resolve(root, 'src/web/public');
const replacements = new Map([
  [5, ['main.png', 'Mod Finder의 실제 검색 시작 화면']],
  [7, ['search.png', 'Mod Finder의 실제 모드 검색 결과']],
  [8, ['tooltip.png', '마우스 트윅 모드의 한국어 설명']],
  [9, ['tooltip.png', '마우스 트윅의 한글 설명 확대: 마우스 버튼에 다양한 편리한 기능을 추가하여 인벤토리 정리 및 아이템 관리를 훨씬 쉽게 만들어 줍니다.']],
  [10, ['filter_off.png', '필터 선택을 끈 실제 프로젝트 종류 화면']],
  [11, ['filter.png', '필터 선택을 켠 실제 프로젝트 종류 화면']],
  [12, ['rankingboard.png', 'Mod Finder의 실제 검색 순위와 다운로드 순위표']],
]);
const captures = new Map([...replacements.values()].map(([name]) => {
  const data = readFileSync(resolve(sourceDir, 'assets/screenshots', name));
  if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Invalid PNG: ${name}`);
  return [name, data];
}));
const pending = new Map();
function publicAsset(data, extension) {
  const name = `${createHash('sha256').update(data).digest('hex').slice(0, 24)}.${extension}`;
  pending.set(resolve(publicDir, 'presentation-assets', name), data);
  return `/presentation-assets/${name}`;
}

function updateCss(css) {
  return css
    .replace(/\.screenshot-focus img \{[^}]*\}/g, '.screenshot-focus img { position: absolute; display: block; width: 100%; height: 100%; max-width: none; max-height: none; object-fit: contain; left: 0; top: 0; transform: none; }')
    .replace(/\.ranking-focus img \{[^}]*\}/g, '.ranking-focus img { top: 0; }')
    .replace('/* Actual JourneyMap screenshot: zoom into its icon, title and Korean tooltip. */', '/* The supplied tooltip is already cropped; show the complete capture. */')
    .replace(/\.description-closeup \{[^}]*\}/g, '.description-closeup { position: absolute; left: 112px; top: 330px; width: 1696px; height: 668px; aspect-ratio: auto; overflow: hidden; }')
    .replace(/\.description-closeup > img \{[^}]*\}/g, '.description-closeup > img { display: block; width: 100%; height: 100%; object-fit: contain; }');
}

function updateHtml(html, mode) {
  const seen = new Set();
  const updated = html.replace(/<section\b[\s\S]*?<\/section>/g, section => {
    const slide = Number(section.match(/aria-labelledby="story-(\d+)"/)?.[1]);
    const replacement = replacements.get(slide);
    if (!replacement) return section;
    const [name, alt] = replacement;
    const data = captures.get(name);
    const src = mode === 'public' ? publicAsset(data, 'png')
      : mode === 'standalone' ? `data:image/png;base64,${data.toString('base64')}`
        : `./assets/screenshots/${name}`;
    if (!/<img\b[^>]*src="[^"]*"[^>]*alt="[^"]*"/.test(section)) throw new Error(`Missing image on slide ${slide}`);
    seen.add(slide);
    return section.replace(/<img\b[^>]*>/, image => image.replace(/src="[^"]*"/, `src="${src}"`).replace(/alt="[^"]*"/, `alt="${alt}"`))
      .replace('<em>JourneyMap</em>', '<em>마우스 트윅</em>');
  });
  if (seen.size !== replacements.size) throw new Error(`${mode}: expected ${replacements.size} screenshots, found ${seen.size}`);
  return updated;
}

for (const [file, mode] of [
  [resolve(sourceDir, 'index.html'), 'local'],
  [resolve(publicDir, 'presentation.html'), 'public'],
  [resolve(root, 'output/발표용/모드파인더.html'), 'standalone'],
]) {
  if (mode === 'standalone' && !existsSync(file)) continue;
  let html = updateHtml(readFileSync(file, 'utf8'), mode);
  if (mode === 'local') html = html.replace(/presentation\.css\?[^"\s]+/, 'presentation.css?v=screenshots-20261101');
  if (mode === 'standalone') html = html.replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => `<style>${updateCss(css)}</style>`);
  if (mode === 'public') html = html.replace(/href="(\/presentation-assets\/[^"/]+\.css)"/g, (attribute, href) => {
    const css = readFileSync(resolve(publicDir, href.slice(1)), 'utf8');
    const updated = updateCss(css);
    return css === updated ? attribute : `href="${publicAsset(updated, 'css')}"`;
  });
  pending.set(file, html);
}
const sourceCss = resolve(sourceDir, 'presentation.css');
pending.set(sourceCss, updateCss(readFileSync(sourceCss, 'utf8')));
// Validate every input before writing any presentation or shared asset.
for (const [file, contents] of pending) writeFileSync(file, contents);
console.log(JSON.stringify({ screenshots: captures.size, placementsPerDeck: replacements.size, files: pending.size }));
