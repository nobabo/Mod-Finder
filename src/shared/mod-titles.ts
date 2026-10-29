import catalog from './locales/mod-titles.ko.json';

export type TitleTranslation = [listingKey: string, original: string, korean: string];
const titleKey = (listingKey: string, original: string) => JSON.stringify([listingKey, original.trim()]);
const games = new Map<string, { entries: TitleTranslation[]; titles: Map<string, string>; searches: Map<string, readonly TitleTranslation[]> }>();

for (const [gameId, rows] of Object.entries(catalog as unknown as Record<string, TitleTranslation[]>)) {
  const candidates = new Map<string, TitleTranslation[]>();
  for (const row of rows) {
    const key = titleKey(row[0], row[1]);
    const matches = candidates.get(key) ?? [];
    matches.push(row); candidates.set(key, matches);
  }
  const entries = [...candidates.values()].filter(rows => new Set(rows.map(row => row[2])).size === 1).map(rows => rows[0]);
  games.set(gameId, { entries, titles: new Map(entries.map(row => [titleKey(row[0], row[1]), row[2]])), searches: new Map() });
}

// Search aliases remain scoped to real provider identities. They never create
// search results or establish an identity relationship between two projects.
export function titleSearchEntries(gameId: string, prefixes: string[]): readonly TitleTranslation[] {
  const game = games.get(gameId);
  if (!game) return [];
  const key = JSON.stringify([...new Set(prefixes)].sort());
  const existing = game.searches.get(key);
  if (existing) return existing;
  const matches = game.entries.filter(row => prefixes.some(prefix => row[0].startsWith(prefix)));
  if (game.searches.size >= 64) game.searches.delete(game.searches.keys().next().value!);
  game.searches.set(key, matches);
  return matches;
}

export function catalogModTitle(gameId: string, listingKey: string, original: string): string | undefined {
  return games.get(gameId)?.titles.get(titleKey(listingKey, original));
}
