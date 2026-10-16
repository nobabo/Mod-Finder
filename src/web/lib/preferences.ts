import { getGame } from '../../shared/games';
import type { Listing, ResultGroup } from '../../shared/types';

const topics: Record<string, string[]> = {
  magic: ['magic', 'spell', 'mana', '마법', '주문', '마나'],
  exploration: ['adventure', 'exploration', 'dungeon', 'worldgen', '탐험', '던전', '유적'],
  combat: ['combat', 'weapon', 'boss', '전투', '무기', '보스'],
  performance: ['optimization', 'performance', 'fps', '최적화', '성능', '렉'],
  building: ['building', 'decoration', 'furniture', '건축', '장식', '가구'],
  farming: ['farming', 'crops', 'farm', '농사', '작물', '농장'],
  technology: ['technology', 'automation', 'storage', '기술', '자동화', '창고'],
  visuals: ['shader', 'graphics', 'texture', '셰이더', '그래픽', '텍스처'],
};
export interface Interest { gameId: string; topics: string[]; query: string; weight: number; at: number }
const normalize = (s: string) => s.normalize('NFKC').toLowerCase();
const topicIds = (text: string) => Object.keys(topics).filter(id => topics[id].some(term => normalize(text).includes(term)));
export function readInterests(value: unknown, now = Date.now()): Interest[] {
  if (!Array.isArray(value)) return [];
  return value.filter((e): e is Interest => !!e && typeof e === 'object' && (e.gameId === 'all' || !!getGame(e.gameId)) &&
    Array.isArray(e.topics) && e.topics.length <= 8 && e.topics.every((t: unknown) => typeof t === 'string' && Object.hasOwn(topics, t)) &&
    typeof e.query === 'string' && e.query.length <= 200 && [1, 2, 4].includes(e.weight) &&
    Number.isFinite(e.at) && e.at <= now && e.at > now - 90 * 86400000).slice(-200);
}
export function recordInterest(events: Interest[] = [], gameId: string, query = '', item?: Listing, now = Date.now()): Interest[] {
  const event: Interest = { gameId, query: query.slice(0, 200), topics: topicIds(item ? [item.title, item.summary, ...item.tags].join(' ') : query), weight: item ? 4 : query ? 2 : 1, at: now };
  const valid = readInterests(events, now);
  const last = valid.at(-1);
  if (last && now - last.at < 30000 && last.gameId === event.gameId && last.query === event.query && last.weight === event.weight && last.topics.join() === event.topics.join()) return valid;
  return [...valid, event].slice(-200);
}
const strength = (e: Interest, now: number) => e.weight * Math.pow(0.5, (now - e.at) / (14 * 86400000));
export function recommendationQueries(events: Interest[], gameId: string, now = Date.now()): string[] {
  const scores = new Map<string, number>();
  for (const event of readInterests(events, now)) {
    if (event.gameId !== 'all' && event.gameId !== gameId) continue;
    for (const query of [...new Set([event.query.trim(), ...event.topics.map(topic => topics[topic][0])])].filter(Boolean)) scores.set(query, (scores.get(query) ?? 0) + strength(event, now));
  }
  return [...scores].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([query]) => query);
}
export function preferredGame(events: Interest[] = [], now = Date.now()): string | undefined {
  const scores = new Map<string, number>();
  for (const e of readInterests(events, now)) if (e.gameId !== 'all') scores.set(e.gameId, (scores.get(e.gameId) ?? 0) + strength(e, now));
  return [...scores].sort((a, b) => b[1] - a[1])[0]?.[0];
}
export function recommend(groups: ResultGroup[], events: Interest[] = [], now = Date.now()): ResultGroup[] {
  const valid = readInterests(events, now);
  const score = (item: Listing) => {
    const text = normalize([item.title, item.summary, ...item.tags].join(' '));
    const categories = topicIds(text);
    return valid.reduce((sum, e) => {
      if (e.gameId !== 'all' && e.gameId !== item.gameId) return sum;
      const terms = normalize(e.query).split(/\s+/).filter(t => t.length > 1);
      return sum + strength(e, now) * (e.topics.filter(t => categories.includes(t)).length + (terms.some(t => text.includes(t)) ? 1 : 0));
    }, 0);
  };
  return groups.map(group => ({ group, score: Math.max(0, ...group.listings.map(score)) })).sort((a, b) => b.score - a.score).map(entry => entry.group);
}
