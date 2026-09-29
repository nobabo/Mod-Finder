import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('output/research', { recursive: true });
const pages = [];
for (let page = 1; page <= 15; page++) {
  const url = `https://gall.dcinside.com/mgallery/board/lists/?id=steve&sort_type=N&search_head=70&page=${page}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'ModFinder/0.1.0' }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw Error(`Page ${page}: ${response.status}`);
  const html = await response.text();
  const titles = [...html.matchAll(/<tr class="ub-content us-post"[\s\S]*?<\/tr>/g)].map(([row]) => ({
    id: row.match(/data-no="(\d+)"/)?.[1],
    title: row.match(/<td class="gall_tit[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1]?.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim(),
  })).filter(item => item.id && item.title);
  if (titles.length < 30) throw Error(`Incomplete page ${page}`);
  pages.push({ page, url, titles });
  console.log(`Page ${page}: ${titles.length}`);
}
await writeFile('output/research/community-titles.json', JSON.stringify({ fetchedAt: new Date().toISOString(), pages }, null, 2));
await writeFile('output/research/community-titles.txt', pages.flatMap(page => page.titles.map(item => item.title)).join('\n'));
