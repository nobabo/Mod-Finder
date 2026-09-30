import { retainedCacheEntries, type SearchCacheEntry, type SearchCacheStore } from './search-cache';

export const SEARCH_CACHE_DATABASE = 'modfinder-search-cache';
const pages = 'pages';

export class IndexedDbSearchCacheStore implements SearchCacheStore {
  private connection?: Promise<IDBDatabase>;
  private unavailable = false;
  constructor(private readonly thunderstoreOptIn = false) {}

  private db(): Promise<IDBDatabase> {
    if (this.unavailable) return Promise.reject(new Error('cache_unavailable'));
    return this.connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      // Blocked upgrades and disabled storage cannot hold up a live search.
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true; clearTimeout(timer); this.unavailable = true; reject(new Error('cache_unavailable'));
      };
      const timer = setTimeout(fail, 500);
      try {
        const request = indexedDB.open(SEARCH_CACHE_DATABASE, 1);
        request.onupgradeneeded = () => { request.result.createObjectStore(pages, { keyPath: 'key' }); };
        request.onerror = fail; request.onblocked = fail;
        request.onsuccess = () => {
          if (settled) { request.result.close(); return; }
          settled = true; clearTimeout(timer);
          const database = request.result;
          database.onversionchange = () => { database.close(); this.connection = undefined; };
          resolve(database);
        };
      } catch { fail(); }
    });
  }

  private async transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> {
    const database = await this.db();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(pages, mode);
      let value: T;
      const timer = setTimeout(() => {
        try { transaction.abort(); } catch { /* It may already have completed. */ }
        reject(new Error('cache_timeout'));
      }, 1000);
      transaction.oncomplete = () => { clearTimeout(timer); resolve(value); };
      transaction.onabort = transaction.onerror = () => { clearTimeout(timer); reject(transaction.error ?? new Error('cache_failed')); };
      try { operation(transaction.objectStore(pages), result => { value = result; }); }
      catch (error) { clearTimeout(timer); transaction.abort(); reject(error); }
    });
  }

  read(key: string): Promise<unknown> {
    return this.transaction('readonly', (store, done) => {
      const request = store.get(key); request.onsuccess = () => done(request.result);
    });
  }

  write(entry: SearchCacheEntry): Promise<void> {
    return this.transaction('readwrite', (store, done) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const existing = request.result as { key?: unknown }[];
        const retained = retainedCacheEntries([entry, ...existing.filter(page => page?.key !== entry.key)], Date.now(), this.thunderstoreOptIn);
        const keys = new Set(retained.map(page => page.key));
        for (const page of existing) if (typeof page?.key === 'string' && !keys.has(page.key)) store.delete(page.key);
        if (keys.has(entry.key)) store.put(entry);
        done(undefined);
      };
    });
  }

  remove(key: string): Promise<void> {
    return this.transaction('readwrite', (store, done) => { store.delete(key); done(undefined); });
  }
}
