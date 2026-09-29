import { readFile, writeFile, rename } from 'node:fs/promises';
import { countCommunityMentions, type CommunityPost } from '../../src/shared/community-ranking';

const data = JSON.parse(await readFile('output/research/community-titles.json', 'utf8')) as { fetchedAt: string; pages: { page: number; url: string; titles: CommunityPost[] }[] };
if (data.pages.length !== 15 || data.pages.some((page, index) => page.page !== index + 1 || page.titles.length < 30)) throw Error('All 15 pages are required');
const posts = data.pages.flatMap(page => page.titles);
const ranking = countCommunityMentions(posts);
if (ranking.length < 10) throw Error('Fewer than ten identified packs');
const snapshot = { fetchedAt: data.fetchedAt, sourceUrl: data.pages[0].url, pages: 15, postCount: new Set(posts.map(post => post.id)).size, basis: 'titles', entries: ranking.slice(0, 10) };
const target = 'src/shared/data/community-ranking.json';
await writeFile(`${target}.tmp`, JSON.stringify(snapshot, null, 2) + '\n');
await rename(`${target}.tmp`, target);
console.log(JSON.stringify({ ...snapshot, entries: snapshot.entries.map(({ postIds: _, ...entry }) => entry) }, null, 2));
