import common from './locales/search.ko.json';
import games from './locales/search.games.ko.json';
import { numberQueries, SEARCH_NOUNS } from './search-number-variants';

const normalized = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export interface SearchKeyword { term: string; aliases: string[] }
const dictionaries = new Map<string, Map<string, SearchKeyword>>();

function dictionary(gameId: string) {
  let dictionary = dictionaries.get(gameId);
  if (dictionary) return dictionary;
  dictionary = new Map();
  const byConcept = new Map<string, SearchKeyword>();
  const entries = [...Object.entries({ ...common, ...(games as Record<string, Record<string, string>>)[gameId] }), ...SEARCH_NOUNS.map(noun => [noun, noun])];
  for (const [alias, term] of entries) {
    const variants = numberQueries(term).map(normalized);
    const key = [...variants].sort()[0];
    const concept = byConcept.get(key) ?? { term, aliases: [] };
    concept.aliases = [...new Set([...concept.aliases, normalized(alias), ...variants])];
    byConcept.set(key, concept);
  }
  for (const concept of byConcept.values()) for (const alias of concept.aliases) dictionary.set(alias, concept);
  dictionaries.set(gameId, dictionary);
  return dictionary;
}

// Split only reviewed keywords, preserving mod names, exact phrases and unknown
// words. Several aliases or repeated words still represent one search concept.
export function searchKeywords(query: string, gameId: string): SearchKeyword[] {
  const terms = dictionary(gameId);
  const queryKey = normalized(query);
  if (terms.has(queryKey)) return [];
  const words = queryKey.split(/[\s,+]+/).filter(Boolean);
  if (words.length < 2 || words.length > 8) return [];
  const concepts = words.map(word => terms.get(word));
  if (concepts.some(concept => !concept)) return [];
  return [...new Set(concepts as SearchKeyword[])];
}

export function searchKeywordEntries(gameId: string): SearchKeyword[] {
  return [...new Set(dictionary(gameId).values())];
}

export function containsSearchTerm(text: string, term: string): boolean {
  if (!text || !term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match English words rather than cow in coward or pig in piglin. Short
  // Korean nouns also need boundaries, so 소 cannot make 소듐 an animal match.
  const ending = /^[가-힣]$/.test(term) ? '(?:[은는이가을를와과의도])?' : '';
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}${ending}($|[^\\p{L}\\p{N}])`, 'u').test(text);
}
