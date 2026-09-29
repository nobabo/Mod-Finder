import { listingKey, SOURCES, type Listing } from '../../shared/types';
import { getCategory } from '../../shared/categories';
import { GENRES, getGame } from '../../shared/games';
import { safeExternalUrl } from '../../shared/links';
import { isNative } from './platform';
export interface FavoriteFolder { id: string; name: string; keys: string[] }
export interface LocalData { favorites: Listing[]; folders: FavoriteFolder[]; compared: Listing[]; favoriteGames: string[]; history: { gameId: string; query: string; genre?: string; category?: string; categories?: string[] }[] }
export const emptyLocalData = (): LocalData => ({ favorites: [], folders: [], compared: [], favoriteGames: ['minecraft-java'], history: [] });
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const nullableText = (value: unknown) => value === null || typeof value === 'string';
const fromRetiredSource = (value: unknown) => !!value && typeof value === 'object' && (value as { source?: unknown }).source === 'atlauncher';
// Persist user bookmark references for CurseForge, never its API payload.
export const canPersistListing = (item: Pick<Listing, 'source'>) => item.source !== 'curseforge';
type FavoriteReference = Pick<Listing, 'source' | 'scope' | 'id' | 'key' | 'gameId'> & { referenceOnly: true };
function reference(item: Pick<Listing, 'source' | 'scope' | 'id' | 'key' | 'gameId'>): FavoriteReference {
  return { source: item.source, scope: item.scope, id: item.id, key: item.key, gameId: item.gameId, referenceOnly: true };
}
function restoreReference(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !(value as FavoriteReference).referenceOnly) return value;
  const item = value as FavoriteReference;
  if (item.source !== 'curseforge' || typeof item.id !== 'string' || !/^\d+$/.test(item.id) || getGame(item.gameId)?.sources.curseforge?.scope !== item.scope || item.key !== listingKey(item.source, item.scope, item.id)) throw new Error('invalid_local_data');
  return { ...reference(item), title: item.key, summary: '', author: null, url: 'https://www.curseforge.com/projects/' + item.id, iconUrl: null, updatedAt: null, versions: null, loaders: null, kind: null, metrics: [], tags: [], rank: 0, fetchedAt: '' } satisfies Listing & { referenceOnly: true };
}
function validListing(value: unknown): value is Listing {
  if (!value || typeof value !== 'object') return false;
  const item = value as Listing;
  return SOURCES.includes(item.source) && typeof item.scope === 'string' && typeof item.id === 'string'
    && item.key === listingKey(item.source, item.scope, item.id) && !!getGame(item.gameId)
    && typeof item.title === 'string' && typeof item.summary === 'string' && nullableText(item.author)
    && typeof item.url === 'string' && !!safeExternalUrl(item.url)
    && (item.iconUrl === null || (typeof item.iconUrl === 'string' && /^https:\/\//.test(item.iconUrl)))
    && nullableText(item.updatedAt) && nullableText(item.kind) && typeof item.fetchedAt === 'string'
    && (item.versions === null || strings(item.versions)) && (item.loaders === null || strings(item.loaders))
    && strings(item.tags) && Number.isFinite(item.rank)
    && Array.isArray(item.metrics) && item.metrics.every(metric => metric && typeof metric.label === 'string' && Number.isFinite(metric.value));
}
export function parseLocalData(raw: string): LocalData {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('invalid_local_data');
  const data = value as LocalData;
  if (!Array.isArray(data.favorites)
    || !strings(data.favoriteGames) || !data.favoriteGames.every(id => !!getGame(id))
    || !Array.isArray(data.history) || !data.history.every(item => item && typeof item.gameId === 'string' && (item.gameId === 'all' || !!getGame(item.gameId)) && typeof item.query === 'string' && (item.category === undefined || (typeof item.category === 'string' && !!getCategory(item.gameId, item.category))) && (item.genre === undefined || item.genre === 'all' || GENRES.some(g => g.id === item.genre)))
    || (data.compared !== undefined && !Array.isArray(data.compared))) throw new Error('invalid_local_data');
  const favorites = data.favorites.filter(item => !fromRetiredSource(item)).map(restoreReference);
  const compared = (data.compared ?? []).filter(item => !fromRetiredSource(item));
  if (!favorites.every(validListing) || !compared.every(validListing)) throw new Error('invalid_local_data');
  if (data.history.some(item => item.categories !== undefined && (!strings(item.categories) || item.categories.some(id => !getCategory(item.gameId, id))))) throw new Error('invalid_local_data');
  const retained = favorites.map(item => canPersistListing(item) ? item : restoreReference(reference(item)) as Listing);
  const keys = new Set(retained.map(item => item.key));
  const used = new Set<string>();
  const folders = data.folders ?? [];
  if (!Array.isArray(folders) || folders.some(folder => !folder || typeof folder.id !== 'string' || !folder.id || folder.id.length > 80 || typeof folder.name !== 'string' || !folder.name.trim() || folder.name.trim().length > 40 || !strings(folder.keys)) || new Set(folders.map(folder => folder.id)).size !== folders.length) throw new Error('invalid_local_data');
  return { favorites: retained, folders: folders.map(folder => ({ id: folder.id, name: folder.name.trim(), keys: folder.keys.filter(key => keys.has(key) && !used.has(key) && !!used.add(key)) })), favoriteGames: data.favoriteGames, history: data.history.slice(0, 20), compared: compared.filter(canPersistListing).slice(0, 3) };
}

export function toggleFavorite(data: LocalData, item: Listing): LocalData {
  const saved = data.favorites.some(favorite => favorite.key === item.key);
  return { ...data, favorites: saved ? data.favorites.filter(favorite => favorite.key !== item.key) : [item, ...data.favorites],
    folders: data.folders.map(folder => ({ ...folder, keys: folder.keys.filter(key => key !== item.key) })) };
}

export function moveFavorite(data: LocalData, key: string, folderId: string | null): LocalData {
  if (!data.favorites.some(item => item.key === key) || (folderId !== null && !data.folders.some(folder => folder.id === folderId))) return data;
  return { ...data, folders: data.folders.map(folder => ({ ...folder, keys: [...folder.keys.filter(value => value !== key), ...(folder.id === folderId ? [key] : [])] })) };
}
let database: Promise<import('@tauri-apps/plugin-sql').default> | undefined;
async function db() {
  database ??= import('@tauri-apps/plugin-sql').then(async ({ default: Database }) => {
    const connection = await Database.load('sqlite:modfinder.db');
    await connection.execute('CREATE TABLE IF NOT EXISTS local_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)');
    return connection;
  });
  return database;
}
export async function loadLocalData(): Promise<LocalData> {
  const raw = isNative() ? (await (await db()).select<{ data: string }[]>('SELECT data FROM local_state WHERE id=1'))[0]?.data : localStorage.getItem('modfinder:local:v1');
  if (!raw) return emptyLocalData();
  const data = parseLocalData(raw);
  const { favoriteDetails } = await import('./api');
  return refreshFavoriteReferences(data, favoriteDetails);
}
export async function refreshFavoriteReferences(data: LocalData, resolve: (item: Listing) => Promise<Listing>): Promise<LocalData> {
  const favorites = [...data.favorites];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, favorites.length) }, async () => {
    while (cursor < favorites.length) {
      const index = cursor++; const item = favorites[index];
      if (canPersistListing(item)) continue;
      try { const fresh = await resolve(item); if (validListing(fresh) && fresh.key === item.key && fresh.gameId === item.gameId) favorites[index] = fresh; } catch { /* Keep the bookmark and folder membership available offline. */ }
    }
  }));
  return { ...data, favorites };
}
let pendingWrite: Promise<unknown> = Promise.resolve();
export function saveLocalData(data: LocalData): Promise<void> {
  const normalized = parseLocalData(JSON.stringify(data));
  const serialized = JSON.stringify({ ...normalized, favorites: normalized.favorites.map(item => canPersistListing(item) ? item : reference(item)) });
  const next = pendingWrite.catch(() => {}).then(async () => {
    if (isNative()) await (await db()).execute('INSERT INTO local_state(id,data) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET data=$1', [serialized]);
    else localStorage.setItem('modfinder:local:v1', serialized);
  });
  pendingWrite = next; return next;
}
