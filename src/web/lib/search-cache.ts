import { getGame } from '../../shared/games';
import { safeExternalUrl } from '../../shared/links';
import { SOURCES, type SearchRequest, type SearchResult, type Source } from '../../shared/types';
import { validListing } from './storage';

export const SEARCH_CACHE_TTL = 30 * 60 * 1000;
export const EMPTY_SEARCH_CACHE_TTL = 5 * 60 * 1000;
export const SEARCH_CACHE_MAX_PAGES = 100;
export const SEARCH_CACHE_MAX_BYTES = 8 * 1024 * 1024;
export interface SearchCacheContext { endpoint: string; locale: string }
export interface SearchCacheEntry {
  key: string; source: Source; savedAt: number; expiresAt: number; bytes: number; payload: string;
}
export interface SearchCacheStore {
  read(key: string): Promise<unknown>;
  write(entry: SearchCacheEntry): Promise<void>;
  remove(key: string): Promise<void>;
}

export function searchCacheKey(request: SearchRequest, context: SearchCacheContext): string {
  const filters = Object.entries(request.filters).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b));
  // Cursors are bound to the exact provider query, so do not lowercase or rewrite it.
  return JSON.stringify([1, context.endpoint, context.locale, request.gameId, request.source, request.query, request.sort, filters, request.cursor ?? null]);
}
export const canCacheSearch = (source: Source, thunderstoreOptIn = false) => source !== 'curseforge' && (source !== 'thunderstore' || thunderstoreOptIn);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const ttl = (result: SearchResult) => result.items.length ? SEARCH_CACHE_TTL : EMPTY_SEARCH_CACHE_TTL;
const size = (key: string, payload: string) => new TextEncoder().encode(key + payload).byteLength;

function validResult(value: unknown, request: SearchRequest): value is SearchResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as SearchResult;
  const scope = getGame(request.gameId)?.sources[request.source]?.scope;
  return !!scope && result.source === request.source && (result.status === 'success' || result.status === 'empty')
    && Array.isArray(result.items) && (result.status !== 'empty' || !result.items.length)
    && result.items.every(item => validListing(item) && item.source === request.source && item.gameId === request.gameId && item.scope === scope
      && (item.matchedCategories === undefined || strings(item.matchedCategories))
      && (item.searchMatch === undefined || (item.searchMatch && typeof item.searchMatch.query === 'string' && typeof item.searchMatch.description === 'boolean')))
    && (result.nextCursor === null || typeof result.nextCursor === 'string')
    && (result.total === null || (Number.isFinite(result.total) && result.total >= 0))
    && typeof result.fetchedAt === 'string' && Number.isFinite(Date.parse(result.fetchedAt)) && typeof result.cached === 'boolean'
    && !!result.appliedFilters && typeof result.appliedFilters === 'object' && !Array.isArray(result.appliedFilters)
    && Object.entries(result.appliedFilters).every(([key, value]) => ['version', 'loader', 'kind', 'category'].includes(key) && typeof value === 'string')
    && strings(result.unsupportedFilters) && typeof result.message === 'string' && typeof result.queryForwarded === 'boolean'
    && (result.externalUrl === null || (typeof result.externalUrl === 'string' && !!safeExternalUrl(result.externalUrl)))
    && (result.verifiedLinks === undefined || (Array.isArray(result.verifiedLinks) && result.verifiedLinks.every(link => link
      && typeof link.projectId === 'string' && strings(link.listingKeys) && typeof link.evidenceUrl === 'string' && /^https:\/\//.test(link.evidenceUrl))));
}

export function validCacheEntry(value: unknown, now: number, thunderstoreOptIn = false): value is SearchCacheEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as SearchCacheEntry;
  return typeof entry.key === 'string' && SOURCES.includes(entry.source) && canCacheSearch(entry.source, thunderstoreOptIn)
    && typeof entry.payload === 'string' && Number.isFinite(entry.savedAt) && entry.savedAt <= now
    && Number.isFinite(entry.expiresAt) && entry.expiresAt > now && entry.expiresAt <= entry.savedAt + SEARCH_CACHE_TTL
    && entry.bytes === size(entry.key, entry.payload) && entry.bytes <= SEARCH_CACHE_MAX_BYTES;
}

// Oldest pages leave first. Replacement and eviction form one IndexedDB transaction.
export function retainedCacheEntries(values: unknown[], now: number, thunderstoreOptIn = false): SearchCacheEntry[] {
  const entries = values.filter((value): value is SearchCacheEntry => validCacheEntry(value, now, thunderstoreOptIn)).sort((a, b) => b.savedAt - a.savedAt);
  let bytes = 0;
  return entries.filter((entry, index) => index < SEARCH_CACHE_MAX_PAGES && (bytes += entry.bytes) <= SEARCH_CACHE_MAX_BYTES);
}

const abortError = () => new DOMException('Search cancelled', 'AbortError');
function checkAbort(signal: AbortSignal) { if (signal.aborted) throw abortError(); }
interface PendingSearch { controller: AbortController; promise: Promise<SearchResult>; subscribers: number }

export class SearchCache {
  private readonly memory = new Map<string, SearchCacheEntry>();
  private readonly pending = new Map<string, PendingSearch>();
  constructor(private readonly store: SearchCacheStore, private readonly thunderstoreOptIn = false, private readonly now = Date.now) {}

  search(request: SearchRequest, context: SearchCacheContext, fetchResult: (signal: AbortSignal) => Promise<SearchResult>, signal: AbortSignal): Promise<SearchResult> {
    if (signal.aborted) return Promise.reject(abortError());
    const key = searchCacheKey(request, context);
    let task = this.pending.get(key);
    if (!task || task.controller.signal.aborted) {
      const controller = new AbortController();
      const next: PendingSearch = { controller, subscribers: 0, promise: Promise.resolve().then(() => this.load(key, request, fetchResult, controller.signal)) };
      next.promise = next.promise.finally(() => { if (this.pending.get(key) === next) this.pending.delete(key); });
      this.pending.set(key, next); task = next;
    }
    return this.subscribe(task, signal);
  }

  private subscribe(task: PendingSearch, signal: AbortSignal): Promise<SearchResult> {
    task.subscribers++;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return false;
        settled = true; task.subscribers--; signal.removeEventListener('abort', abort); return true;
      };
      const abort = () => {
        if (!finish()) return;
        if (!task.subscribers) task.controller.abort();
        reject(abortError());
      };
      signal.addEventListener('abort', abort, { once: true });
      task.promise.then(result => {
        if (!finish()) return;
        try { resolve(JSON.parse(JSON.stringify(result)) as SearchResult); } catch (error) { reject(error); }
      }, error => { if (finish()) reject(error); });
    });
  }

  private async load(key: string, request: SearchRequest, fetchResult: (signal: AbortSignal) => Promise<SearchResult>, signal: AbortSignal): Promise<SearchResult> {
    checkAbort(signal);
    const eligible = canCacheSearch(request.source, this.thunderstoreOptIn);
    if (eligible) {
      let entry: unknown = this.memory.get(key);
      if (!entry) { try { entry = await this.store.read(key); } catch { /* Storage is optional, including in private browsing. */ } }
      checkAbort(signal);
      if (entry) {
        try {
          if (validCacheEntry(entry, this.now(), this.thunderstoreOptIn) && entry.key === key && entry.source === request.source) {
            const result: unknown = JSON.parse(entry.payload);
            if (validResult(result, request) && entry.expiresAt <= entry.savedAt + ttl(result)) {
              this.remember(entry); return { ...result, cached: true };
            }
          }
        } catch { /* Ignore incomplete or corrupt snapshots. */ }
        this.memory.delete(key);
        try { await this.store.remove(key); } catch { /* The live result still works. */ }
      }
    }
    checkAbort(signal);
    const result = await fetchResult(signal);
    checkAbort(signal);
    if (eligible && validResult(result, request)) {
      const payload = JSON.stringify({ ...result, cached: false });
      const savedAt = this.now();
      const entry: SearchCacheEntry = { key, source: request.source, savedAt, expiresAt: savedAt + ttl(result), bytes: size(key, payload), payload };
      if (validCacheEntry(entry, savedAt, this.thunderstoreOptIn)) {
        this.remember(entry);
        try { await this.store.write(entry); } catch { /* Quota or disk failures must not turn a search into an error. */ }
      }
    }
    checkAbort(signal);
    return result;
  }

  private remember(entry: SearchCacheEntry) {
    this.memory.delete(entry.key);
    const retained = retainedCacheEntries([entry, ...this.memory.values()], this.now(), this.thunderstoreOptIn);
    this.memory.clear();
    for (const page of retained) this.memory.set(page.key, page);
  }
}
