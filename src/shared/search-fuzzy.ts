import Fuse from 'fuse.js';
import { disassemble } from 'es-hangul';
import { modTranslations } from './content';
import { communityMods } from './community-ranking';
import { communityRanking } from './community-snapshots';
import { getGame } from './games';
import commonAliases from './locales/search.ko.json';
import gameAliases from './locales/search.games.ko.json';
import packNames from './data/community-pack-names.ko.json';
import type { Source } from './types';

interface SearchAlias { name: string; term: string }
const normalize = (value: string) => disassemble(value.normalize('NFC').toLowerCase()).replace(/\s+/g, '');
const termKey = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

// Fuse also matches substrings. Check whole-name distance before accepting a
// correction so a short keyword cannot silently become a much longer mod title.
function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
      rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

export function createFuzzyMatcher(aliases: SearchAlias[]): (query: string) => string[] {
  const entries = [...new Map(aliases.filter(entry => entry.name.trim() && entry.term.trim())
    .map(entry => ({ ...entry, text: normalize(entry.name) }))
    .map(entry => [JSON.stringify([entry.text, termKey(entry.term)]), entry])).values()];
  const exact = new Set(entries.map(entry => entry.text));
  const fuse = new Fuse(entries, { keys: ['text'], includeScore: true, threshold: 0.3,
    ignoreLocation: true, ignoreFieldNorm: true, minMatchCharLength: 2 });
  return query => {
    const text = normalize(query);
    // Short abbreviations and version numbers need an exact match, not a guess.
    if (query.length > 96 || text.length < 5 || text.length > 96 || exact.has(text)) return [];
    const digits = query.match(/\d+/g)?.join(',') ?? '';
    const candidates = new Map<string, { term: string; score: number }>();
    for (const { item } of fuse.search(text)) {
      if (Math.abs(item.text.length - text.length) > 2 || (item.name.match(/\d+/g)?.join(',') ?? '') !== digits) continue;
      const edits = distance(text, item.text);
      const score = edits / Math.max(text.length, item.text.length);
      if (edits > (text.length < 8 ? 1 : 2) || score > 0.22) continue;
      const key = termKey(item.term);
      if (!candidates.has(key) || candidates.get(key)!.score > score) candidates.set(key, { term: item.term, score });
    }
    const ranked = [...candidates.values()].sort((a, b) => a.score - b.score || a.term.localeCompare(b.term));
    // Multiple aliases for the same query are fine; competing meanings are not.
    if (!ranked.length || (ranked[1] && ranked[1].score - ranked[0].score < 0.06)) return [];
    return [ranked[0].term];
  };
}

const matchers = new Map<string, ReturnType<typeof createFuzzyMatcher>>();
export function fuzzyQueries(query: string, gameId: string, source: Source): string[] {
  const scope = getGame(gameId)?.sources[source]?.scope;
  if (!scope) return [];
  const key = `${source}:${scope}:`;
  const cacheKey = `${gameId}:${key}`;
  let matcher = matchers.get(cacheKey);
  if (!matcher) {
    const aliases: SearchAlias[] = [];
    const add = (name: string | undefined, term: string) => { if (name) aliases.push({ name, term }); };
    for (const [id, entry] of Object.entries(modTranslations)) if (id.startsWith(key)) {
      for (const name of [entry.searchTerm, entry.title, ...entry.aliases]) add(name, entry.searchTerm);
    }
    for (const [name, term] of Object.entries({ ...commonAliases, ...(gameAliases as Record<string, Record<string, string>>)[gameId] })) {
      add(name, term); add(term, term);
    }
    for (const entry of [...communityMods(gameId), ...(communityRanking(gameId)?.entries ?? [])]) {
      add(entry.name, entry.name);
      add(entry.koreanName ?? (gameId === 'minecraft-java' ? (packNames as Record<string, string>)[entry.id] : undefined), entry.name);
    }
    matcher = createFuzzyMatcher(aliases);
    matchers.set(cacheKey, matcher);
  }
  return matcher(query);
}
