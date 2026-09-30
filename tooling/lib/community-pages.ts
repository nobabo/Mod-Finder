import { COMMUNITY_GALLERIES, COMMUNITY_SAMPLE_SIZE, type CommunityPost } from '../../src/shared/community-ranking';

export interface CommunityPage { page: number; totalPages: number; head: string; url: string; titles: CommunityPost[] }
export interface CommunityCollection { gameId: string; galleryId: string; fetchedAt: string; pages: CommunityPage[]; posts: CommunityPost[] }
const decodeText = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&#(x[\da-f]+|\d+);/gi, (_, number: string) => {
  const code = number.toLowerCase().startsWith('x') ? parseInt(number.slice(1), 16) : Number(number);
  return code <= 0x10ffff ? String.fromCodePoint(code) : '';
}).replace(/&(?:amp|quot|apos|nbsp|lt|gt);/g, token => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ', '&lt;': '<', '&gt;': '>' })[token] ?? token).trim();

export function galleryPageUrl(gameId: string, head: string, page: number): string {
  const gallery = COMMUNITY_GALLERIES[gameId];
  if (!gallery?.heads.some(item => item.id === head) || !Number.isInteger(page) || page < 1 || page > 15) throw Error('Invalid gallery page');
  return `https://gall.dcinside.com/mgallery/board/lists/?id=${gallery.id}&sort_type=N&search_head=${head}&page=${page}`;
}

export function parseCommunityPage(html: string, gameId: string, head: string): CommunityPost[] {
  const gallery = COMMUNITY_GALLERIES[gameId];
  const configuredHead = gallery?.heads.find(item => item.id === head);
  if (!configuredHead || html.length > 2_000_000) throw Error('Invalid gallery response');
  const availableHeads = [...html.matchAll(/<a\b[^>]*onclick="listSearchHead\((\d+)\)"[^>]*>([\s\S]*?)<\/a>/g)];
  const actualHead = availableHeads.find(([, id]) => id === head);
  // A renamed/removed category or ignored filter must never become a general-board ranking.
  if (!actualHead || decodeText(actualHead[2]) !== configuredHead.label || !new RegExp(`id="search_head"[^>]*value="${head}"`).test(html)) throw Error('Gallery category changed');
  const posts: CommunityPost[] = [];
  for (const [row] of html.matchAll(/<tr\b[^>]*class="[^"]*\bus-post\b[^"]*"[^>]*>[\s\S]*?<\/tr>/g)) {
    const id = row.match(/data-no="(\d+)"/)?.[1];
    const subject = row.match(/<td\b[^>]*class="gall_subject"[^>]*>([\s\S]*?)<\/td>/)?.[1];
    const titleHtml = row.match(/<td\b[^>]*class="gall_tit[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1];
    const fullSubject = subject?.match(/<p\b[^>]*class="subject_inner"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? subject;
    if (!id || !fullSubject || decodeText(fullSubject) !== configuredHead.label) continue;
    const title = titleHtml && decodeText(titleHtml);
    if (title) posts.push({ id, title });
  }
  if (!posts.length && !/등록된 게시물이 없습니다/.test(html)) throw Error('Incomplete gallery page');
  return [...new Map(posts.map(post => [post.id, post])).values()];
}

export function parseCommunityPagination(html: string, expectedPage: number): number {
  const current = Number(html.match(/name="move_page"\s+value="(\d+)"/)?.[1]);
  const total = Number(html.match(/class="num total_page">(\d+)<\/span>/)?.[1]);
  if (current !== expectedPage || !Number.isInteger(total) || total < expectedPage) throw Error('Invalid gallery pagination');
  return total;
}

export function collectionPosts(pages: CommunityPage[]): CommunityPost[] {
  return [...new Map(pages.flatMap(page => page.titles).map(post => [post.id, post])).values()]
    // Decimal IDs stay strings even while choosing the newest posts across categories.
    .sort((a, b) => b.id.length - a.id.length || b.id.localeCompare(a.id)).slice(0, COMMUNITY_SAMPLE_SIZE);
}

export function validateCollection(collection: CommunityCollection): void {
  const gallery = COMMUNITY_GALLERIES[collection.gameId];
  if (!gallery || gallery.id !== collection.galleryId || !Number.isFinite(Date.parse(collection.fetchedAt))) throw Error('Invalid community collection');
  if (collection.pages.some(page => !gallery.heads.some(head => head.id === page.head) || page.titles.some(post => typeof post.id !== 'string' || !/^\d+$/.test(post.id) || !post.title.trim()))) throw Error('Invalid gallery posts');
  for (const head of gallery.heads) {
    const pages = collection.pages.filter(page => page.head === head.id);
    if (!pages.length || pages.length > 15 || pages.some((page, index) => page.page !== index + 1 || page.url !== galleryPageUrl(collection.gameId, head.id, page.page))) throw Error('Missing gallery pages');
    const posts = collectionPosts(pages);
    if (pages.some(page => !Number.isInteger(page.totalPages) || page.totalPages < page.page)) throw Error('Invalid gallery pagination');
    if (pages.length < 15 && posts.length < COMMUNITY_SAMPLE_SIZE && pages.at(-1)!.page !== pages.at(-1)!.totalPages) throw Error('Missing end of gallery');
  }
  if (JSON.stringify(collection.posts) !== JSON.stringify(collectionPosts(collection.pages))) throw Error('Community sample mismatch');
}
