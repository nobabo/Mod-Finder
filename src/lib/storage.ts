import { listingKey, SOURCES, type Listing } from '../../shared/types';
import { getCategory } from '../../shared/categories';
import { GENRES, getGame } from '../../shared/games';
import { safeExternalUrl } from '../../shared/links';
import { isNative } from './platform';
export interface LocalData { favorites: Listing[]; compared: Listing[]; favoriteGames: string[]; history: { gameId: string; query: string; genre?: string; category?: string }[] }
export const emptyLocalData = (): LocalData => ({ favorites: [], compared: [], favoriteGames: ['minecraft-java'], history: [] });
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const nullableText = (value: unknown) => value === null || typeof value === 'string';
const fromRetiredSource = (value: unknown) => !!value && typeof value === 'object' && (value as { source?: unknown }).source === 'atlauncher';
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
  const favorites = data.favorites.filter(item => !fromRetiredSource(item));
  const compared = (data.compared ?? []).filter(item => !fromRetiredSource(item));
  if (!favorites.every(validListing) || !compared.every(validListing)) throw new Error('invalid_local_data');
  return { favorites, favoriteGames: data.favoriteGames, history: data.history.slice(0, 20), compared: compared.slice(0, 3) };
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
  return parseLocalData(raw);
}
let pendingWrite: Promise<unknown> = Promise.resolve();
export function saveLocalData(data: LocalData): Promise<void> {
  const serialized = JSON.stringify(data);
  const next = pendingWrite.catch(() => {}).then(async () => {
    if (isNative()) await (await db()).execute('INSERT INTO local_state(id,data) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET data=$1', [serialized]);
    else localStorage.setItem('modfinder:local:v1', serialized);
  });
  pendingWrite = next; return next;
}
