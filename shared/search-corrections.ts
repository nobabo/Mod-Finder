import corrections from './data/search-corrections.json';
import { GENRES, getGame } from './games';
import { runSearchQueue, searchPlan, bucketKey, type SearchSpec } from './search-plan';
import type { SearchRequest } from './types';

const initials = ['r', 'R', 's', 'e', 'E', 'f', 'a', 'q', 'Q', 't', 'T', 'd', 'w', 'W', 'c', 'z', 'x', 'v', 'g'];
const vowels = ['k', 'o', 'i', 'O', 'j', 'p', 'u', 'P', 'h', 'hk', 'ho', 'hl', 'y', 'n', 'nj', 'np', 'nl', 'b', 'm', 'ml', 'l'];
const finals = ['', 'r', 'R', 'rt', 's', 'sw', 'sg', 'e', 'f', 'fr', 'fa', 'fq', 'ft', 'fx', 'fv', 'fg', 'a', 'q', 'qt', 't', 'T', 'd', 'w', 'c', 'z', 'x', 'v', 'g'];
const consonants = ['r', 'R', 'rt', 's', 'sw', 'sg', 'e', 'E', 'f', 'fr', 'fa', 'fq', 'ft', 'fx', 'fv', 'fg', 'a', 'q', 'Q', 'qt', 't', 'T', 'd', 'w', 'W', 'c', 'z', 'x', 'v', 'g'];
const common: Record<string, string> = corrections.common;
const byGenre: Record<string, Record<string, string>> = corrections.genres;

// Decompose syllables before mapping each two-set Korean keyboard key.
export function koreanKeyboardToEnglish(value: string): string {
  return [...value.normalize('NFC')].map(character => {
    const code = character.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const offset = code - 0xac00;
      return initials[Math.floor(offset / 588)] + vowels[Math.floor(offset % 588 / 28)] + finals[offset % 28];
    }
    if (code >= 0x3131 && code <= 0x314e) return consonants[code - 0x3131];
    if (code >= 0x314f && code <= 0x3163) return vowels[code - 0x314f];
    if (code >= 0x1100 && code <= 0x1112) return initials[code - 0x1100];
    if (code >= 0x1161 && code <= 0x1175) return vowels[code - 0x1161];
    if (code >= 0x11a8 && code <= 0x11c2) return finals[code - 0x11a7];
    return character;
  }).join('');
}

function genresForScope(scope?: Pick<SearchSpec, 'gameId' | 'genre'>): string[] {
  if (scope?.gameId && scope.gameId !== 'all') return getGame(scope.gameId)?.genres ?? [];
  if (scope?.genre && scope.genre !== 'all') return [scope.genre];
  return GENRES.map(genre => genre.id);
}

function correctTypos(query: string, genres: string[]): string {
  const lookup = (word: string) => {
    const key = word.toLowerCase();
    if (Object.hasOwn(common, key)) return common[key];
    const matches = new Set(genres.map(genre => {
      const entries = byGenre[genre];
      return entries && Object.hasOwn(entries, key) ? entries[key] : undefined;
    }).filter((value): value is string => !!value));
    return matches.size === 1 ? [...matches][0] : word;
  };
  return lookup(query).replace(/[A-Za-z]+/g, lookup);
}

export function correctedQueries(query: string, scope?: Pick<SearchSpec, 'gameId' | 'genre'>): string[] {
  const original = query.trim().normalize('NFC');
  if (!original) return [];
  const genres = genresForScope(scope);
  const corrected = correctTypos(original, genres);
  const keyboard = correctTypos(koreanKeyboardToEnglish(original), genres);
  return [...new Set([corrected, keyboard])].filter(value => value.toLowerCase() !== original.toLowerCase());
}

export interface SearchOutcome { hasItems: boolean; empty: boolean }

// Retry only sources that actually finished empty, after the entire original search.
export async function runSearchWithCorrections(
  spec: SearchSpec,
  run: (request: SearchRequest) => Promise<SearchOutcome | undefined>,
  signal: AbortSignal,
  onRound: (requests: SearchRequest[]) => void,
) {
  let requests = searchPlan(spec);
  const tried = new Set<string>();
  const candidates = [spec.query, ...correctedQueries(spec.query, spec)];
  for (const query of candidates) {
    if (signal.aborted || !requests.length) return;
    const eligible = new Set(requests.map(bucketKey));
    requests = searchPlan({ ...spec, query }).filter(request => {
      const key = JSON.stringify(request);
      if (!eligible.has(bucketKey(request)) || tried.has(key)) return false;
      tried.add(key);
      return true;
    });
    const outcomes = new Map<string, SearchOutcome | undefined>();
    onRound(requests);
    await runSearchQueue(requests, async request => { outcomes.set(bucketKey(request), await run(request)); }, signal);
    if ([...outcomes.values()].some(outcome => outcome?.hasItems)) return;
    requests = requests.filter(request => outcomes.get(bucketKey(request))?.empty);
  }
}
