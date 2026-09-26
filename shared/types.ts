export const SOURCES = ['modrinth', 'curseforge', 'thunderstore', 'nexus', 'steam'] as const;
export type Source = typeof SOURCES[number];
export const SOURCE_NAMES: Record<Source, string> = {
  modrinth: 'Modrinth', curseforge: 'CurseForge', thunderstore: 'Thunderstore', nexus: 'Nexus Mods', steam: 'Steam Workshop',
};
export type SourceStatus = 'ready' | 'success' | 'empty' | 'external' | 'auth_required' | 'unsupported' | 'error' | 'rate_limited' | 'disabled';
export type Filters = { version?: string; loader?: string; kind?: string; category?: string };
export type Sort = 'relevance' | 'downloads' | 'popular' | 'updated';
export interface Game {
  id: string; name: string; koreanName: string; aliases: string[]; edition: string;
  short: string; color: string; genres: string[]; image?: string;
  sources: Partial<Record<Source, { scope: string; slug?: string }>>;
}
export interface Capability {
  source: Source; status: SourceStatus; filters: (keyof Filters)[]; sorts: Sort[];
  message: string; externalUrl: string | null; queryForwarded: boolean;
}
export interface Listing {
  key: string; source: Source; scope: string; id: string; gameId: string;
  title: string; author: string | null; summary: string; url: string;
  iconUrl: string | null; updatedAt: string | null; versions: string[] | null;
  loaders: string[] | null; kind: string | null;
  metrics: { label: string; value: number }[];
  tags: string[]; rank: number; fetchedAt: string;
  searchMatch?: { query: string; description: boolean };
}
export interface SearchRequest {
  gameId: string; source: Source; query: string; filters: Filters; sort: Sort; cursor?: string;
}
export interface SearchResult {
  source: Source; status: SourceStatus; items: Listing[]; nextCursor: string | null;
  total: number | null; fetchedAt: string; cached: boolean;
  appliedFilters: Filters; unsupportedFilters: string[]; externalUrl: string | null;
  queryForwarded: boolean; message: string; retryAfter?: number;
  verifiedLinks?: VerifiedProjectLink[];
}
export interface SourceAdapter {
  source: Source;
  getCapabilities(game: Game): Capability;
  search(request: SearchRequest): Promise<SearchResult>;
  getDetails(game: Game, id: string): Promise<Listing | null>;
}
export interface VerifiedProjectLink { projectId: string; listingKeys: string[]; evidenceUrl: string }
export interface ResultGroup { id: string; listings: Listing[] }
export const listingKey = (source: Source, scope: string, id: string) => `${source}:${scope}:${id}`;
