import { readFile, rename, writeFile } from 'node:fs/promises';
import { COMMUNITY_GALLERIES, countCommunityMentions, type CommunitySnapshot } from '../../src/shared/community-ranking';
import { validateCollection, type CommunityCollection } from '../lib/community-pages';

const collections = JSON.parse(await readFile('output/research/community-titles.json', 'utf8')) as Record<string, CommunityCollection>;
const snapshots: Record<string, CommunitySnapshot> = {};
for (const gameId of Object.keys(COMMUNITY_GALLERIES)) {
  const collection = collections[gameId];
  if (!collection || collection.gameId !== gameId) throw Error(`Missing game: ${gameId}`);
  validateCollection(collection);
  const sourceUrls = collection.pages.filter(page => page.page === 1).map(page => page.url);
  snapshots[gameId] = {
    gameId, fetchedAt: collection.fetchedAt, sourceUrl: sourceUrls[0], sourceUrls,
    pages: collection.pages.length, postCount: collection.posts.length, basis: 'titles', entries: countCommunityMentions(collection.posts, gameId).slice(0, 10),
  };
}
const target = 'src/shared/data/community-rankings.json';
await writeFile(`${target}.tmp`, JSON.stringify(snapshots, null, 2) + '\n');
await rename(`${target}.tmp`, target);
// Keep the legacy Minecraft snapshot available to existing native clients.
const minecraftTarget = 'src/shared/data/community-ranking.json';
await writeFile(`${minecraftTarget}.tmp`, JSON.stringify(snapshots['minecraft-java'], null, 2) + '\n');
await rename(`${minecraftTarget}.tmp`, minecraftTarget);
for (const [gameId, snapshot] of Object.entries(snapshots)) console.log(`${gameId}: ${snapshot.entries.map(entry => `${entry.name} (${entry.mentions})`).join(', ')}`);
