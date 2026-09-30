import { mkdir, rename, writeFile } from 'node:fs/promises';
import { COMMUNITY_GALLERIES, COMMUNITY_SAMPLE_SIZE } from '../../src/shared/community-ranking';
import { collectionPosts, galleryPageUrl, parseCommunityPage, parseCommunityPagination, validateCollection, type CommunityCollection, type CommunityPage } from '../lib/community-pages';

await mkdir('output/research', { recursive: true });
const collections: Record<string, CommunityCollection> = {};
for (const [gameId, gallery] of Object.entries(COMMUNITY_GALLERIES)) {
  const pages: CommunityPage[] = [];
  for (const head of gallery.heads) {
    const headPages: CommunityPage[] = [];
    for (let page = 1; page <= 15; page++) {
      const url = galleryPageUrl(gameId, head.id, page);
      const response = await fetch(url, { headers: { 'User-Agent': 'ModFinder/0.1.0' }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error(`${gameId}/${head.id}/${page}: HTTP ${response.status}`);
      const html = await response.text();
      const titles = parseCommunityPage(html, gameId, head.id);
      const totalPages = parseCommunityPagination(html, page);
      if (titles.length < 30 && page < totalPages) throw Error(`${gameId}/${head.id}/${page}: Incomplete page`);
      if (titles.length && headPages.some(previous => JSON.stringify(previous.titles) === JSON.stringify(titles))) throw Error('Gallery repeated a page');
      headPages.push({ page, totalPages, head: head.id, url, titles });
      if (page === totalPages || collectionPosts(headPages).length >= COMMUNITY_SAMPLE_SIZE) break;
    }
    pages.push(...headPages);
  }
  const collection = { gameId, galleryId: gallery.id, fetchedAt: new Date().toISOString(), pages, posts: collectionPosts(pages) };
  validateCollection(collection);
  collections[gameId] = collection;
  console.log(`${gameId}: ${collection.posts.length} posts in ${pages.length} pages`);
}
// A failed page leaves the previous complete input and published snapshots untouched.
const target = 'output/research/community-titles.json';
await writeFile(`${target}.tmp`, JSON.stringify(collections, null, 2) + '\n');
await rename(`${target}.tmp`, target);
