import { convertHangulToQwerty } from 'es-hangul';
import { fuzzyQueries } from './search-fuzzy';
import corrections from './data/search-corrections.json';
import { GENRES, getGame } from './games';
import { runSearchQueue, searchPlan, bucketKey, sourceBucketKey, type SearchSpec } from './search-plan';
import type { SearchRequest } from './types';

const common: Record<string, string> = corrections.common;
const byGenre: Record<string, Record<string, string>> = corrections.genres;

// Keep decomposed Unicode input equivalent to ordinary Korean keyboard input.
export function koreanKeyboardToEnglish(value: string): string {
  return convertHangulToQwerty(value.normalize('NFC'));
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
  const original = searchPlan(spec);
  const eligible = new Map(original.map(request => [sourceBucketKey(request), request]));
  const tried = new Set<string>();
  const round = async (candidates: SearchRequest[]) => {
    const requests = candidates.filter(request => {
      const key = bucketKey(request);
      if (!eligible.has(sourceBucketKey(request)) || tried.has(key)) return false;
      tried.add(key);
      return true;
    });
    if (!requests.length || signal.aborted) return false;
    let hasItems = false;
    onRound(requests);
    await runSearchQueue(requests, async request => {
      const outcome = await run(request);
      if (outcome?.hasItems) hasItems = true;
      // A failed or unavailable variant does not establish an empty bucket.
      if (!outcome?.empty || outcome.hasItems) eligible.delete(sourceBucketKey(request));
    }, signal);
    return hasItems;
  };
  if (await round(original)) return;
  for (const query of correctedQueries(spec.query, spec)) {
    if (signal.aborted || !eligible.size) return;
    if (await round(searchPlan({ ...spec, query }))) return;
  }
  if (signal.aborted || !eligible.size) return;
  // One confident fuzzy candidate per eligible game/source; never fan a game's
  // corrected name out across other games in a global search.
  const fuzzyRequests = [...eligible.values()].flatMap(request =>
    fuzzyQueries(spec.query, request.gameId, request.source).flatMap(query =>
      searchPlan({ ...spec, gameId: request.gameId, selectedSource: request.source,
        categories: undefined, filters: request.filters, query }))
  );
  await round(fuzzyRequests);
}
