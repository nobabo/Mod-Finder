// Dedicated Playwright CLI session against npm run dev:ui.
async (page) => {
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const origin = new URL(page.url()).origin;
  const counts = new Map();
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    if (!['http:', 'https:'].includes(location.protocol)) return;
    localStorage.setItem('modfinder-intro-seen', '1');
    document.cookie = 'mf-language=ko; Path=/; SameSite=Lax';
  });
  const req = { gameId: 'minecraft-java', source: 'modrinth', query: 'cache-fixture', filters: {}, sort: 'downloads' };
  const keyFor = params => JSON.stringify([params.get('source'), params.get('query'), params.get('cursor'), params.get('sort'), params.get('loader')]);
  const count = (query, cursor = null, sort = 'downloads', loader = null, source = 'modrinth') => counts.get(JSON.stringify([source, query, cursor, sort, loader])) ?? 0;
  await page.route('**/v1/search?**', async route => {
    const params = new URL(route.request().url()).searchParams;
    const key = keyFor(params); counts.set(key, (counts.get(key) ?? 0) + 1);
    const source = params.get('source'); const query = params.get('query');
    if (query === 'network-error') { await route.fulfill({ status: 502, json: { error: 'unavailable' } }); return; }
    const empty = source !== 'modrinth' || query === 'empty-fixture';
    const error = query === 'source-error';
    const next = !!params.get('cursor');
    const id = next ? 'cache-second' : 'cache-first';
    const now = new Date().toISOString();
    const items = empty || error ? [] : [{ key: `modrinth:minecraft:${id}`, source, scope: 'minecraft', id, gameId: 'minecraft-java', title: next ? 'Cache Fixture Second' : 'Cache Fixture First', summary: 'Cache verification', rank: next ? 2 : 1, author: null, url: 'https://modrinth.com/mod/sodium', iconUrl: null, updatedAt: null, versions: null, loaders: null, kind: 'mod', metrics: [], tags: [], fetchedAt: now }];
    await route.fulfill({ json: { source, status: error ? 'error' : empty ? 'empty' : 'success', items, nextCursor: empty || error || next ? null : 'page-2', total: null, fetchedAt: now, cached: false, appliedFilters: Object.fromEntries(['loader', 'version', 'kind', 'category'].filter(name => params.has(name)).map(name => [name, params.get(name)])), unsupportedFilters: [], externalUrl: null, queryForwarded: true, message: '' } });
  });
  const call = request => page.evaluate(async request => {
    const { searchSource } = await import('/lib/api.ts');
    return searchSource(request, new AbortController().signal);
  }, request);
  const disk = (action = 'read') => page.evaluate(async action => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('modfinder-search-cache', 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction('pages', action === 'read' ? 'readonly' : 'readwrite');
        const store = transaction.objectStore('pages');
        const request = store.getAll(); let entries = [];
        request.onsuccess = () => {
          entries = request.result;
          if (action === 'expire') entries.filter(entry => entry.key.includes('cache-fixture')).forEach(entry => store.put({ ...entry, expiresAt: Date.now() - 1 }));
          if (action === 'corrupt') entries.filter(entry => entry.key.includes('cache-fixture')).forEach(entry => store.put({ ...entry, payload: '{' }));
        };
        transaction.oncomplete = () => resolve(entries); transaction.onabort = transaction.onerror = () => reject(transaction.error);
      });
    } finally { database.close(); }
  }, action);
  const submit = async () => {
    await page.locator('#mod-query').fill(req.query);
    await page.locator('#mod-query').press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.mod-card').length === 2);
    await page.waitForFunction(() => !document.querySelector('[aria-label="검색 중"]'));
  };
  try {
    // Leaving the app releases connections before clearing the test profile's cache.
    await page.goto('about:blank'); await page.goto(origin);
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase('modfinder-search-cache');
        request.onsuccess = resolve; request.onerror = () => reject(request.error); request.onblocked = () => reject(Error('Cache database still open'));
      });
    });
    await page.reload();
    await submit();
    assert(count(req.query) === 1 && count(req.query, 'page-2') === 1, 'Initial search fetches each page once');
    const entries = await disk();
    assert(entries.filter(entry => entry.key.includes(req.query)).length === 2, 'Both complete pages persist in IndexedDB');
    assert(entries.every(entry => !['curseforge', 'thunderstore'].includes(entry.source)), 'Restricted sources never reach disk');
    await submit();
    assert(count(req.query) === 1 && count(req.query, 'page-2') === 1, 'Repeated UI search uses local pages');
    await page.reload(); await submit();
    assert(count(req.query) === 1 && count(req.query, 'page-2') === 1, 'UI search after reload uses persisted pages');
    const cached = await call(req);
    assert(cached.cached && cached.nextCursor === 'page-2' && cached.total === null && cached.items[0].versions === null && cached.items[0].loaders === null, 'Cached response preserves cursor and unknown metadata');
    await page.screenshot({ path: 'output/playwright/search-cache-reloaded.png' });

    await call({ ...req, sort: 'updated' });
    await call({ ...req, filters: { loader: 'fabric' } });
    assert(count(req.query, null, 'updated') === 1 && count(req.query, null, 'downloads', 'fabric') === 1, 'Sort and filter changes fetch separate pages');
    const concurrent = { ...req, query: 'concurrent-fixture' };
    const responses = await page.evaluate(async request => {
      const { searchSource } = await import('/lib/api.ts');
      return Promise.all([searchSource(request, new AbortController().signal), searchSource(request, new AbortController().signal)]);
    }, concurrent);
    assert(responses.every(response => response.status === 'success') && count(concurrent.query) === 1, 'Concurrent callers share the real API fetch');

    for (const query of ['source-error', 'network-error']) {
      const errorReq = { ...req, query };
      await call(errorReq).catch(() => {}); await call(errorReq).catch(() => {});
      assert(count(query) === 2, `${query} is retried live`);
    }
    const empty = { ...req, query: 'empty-fixture' };
    await call(empty); assert((await call(empty)).cached && count(empty.query) === 1, 'Empty results use their local snapshot');
    const zero = (await disk()).find(entry => entry.key.includes(empty.query));
    assert(zero.expiresAt - zero.savedAt === 5 * 60 * 1000, 'Empty page TTL is five minutes');

    await disk('expire'); await page.reload();
    assert(!(await call(req)).cached && count(req.query) === 2, 'Expired disk result fetches live after reload');
    await disk('corrupt'); await page.reload();
    assert(!(await call(req)).cached && count(req.query) === 3, 'Corrupt disk result is replaced by a complete live snapshot');
    const after = await disk();
    assert(!after.some(entry => entry.payload === '{'), 'Atomic replacement also removes malformed snapshots');
    assert(after.some(entry => entry.key.includes(req.query) && entry.payload !== '{'), 'Requested corrupt page is repaired');

    // A storage denial must still render results and reuse memory during this visit.
    await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { configurable: true, get() { throw new DOMException('Storage denied', 'SecurityError'); } }));
    await page.reload();
    const blocked = { ...req, query: 'blocked-fixture' };
    assert((await call(blocked)).status === 'success', 'Storage denial does not fail a search');
    assert((await call(blocked)).cached && count(blocked.query) === 1, 'Storage denial falls back to memory');
    await page.locator('#mod-query').fill(blocked.query); await page.locator('#mod-query').press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.mod-card').length === 2);
    await page.screenshot({ path: 'output/playwright/search-cache-storage-denied.png' });
    assert(errors.length === 0, 'No browser errors: ' + errors.join(', '));
    console.log(JSON.stringify({ status: 'passed', persistedPages: entries.length, identicalPageNetworkCallsAfterReload: 1, checks: ['UI repeat', 'IndexedDB reload', 'complete pages', 'source restrictions', 'filter and sort isolation', 'concurrent fetch', 'empty TTL', 'errors retried', 'expiry', 'corruption', 'storage denial'], screenshots: ['search-cache-reloaded.png', 'search-cache-storage-denied.png'] }));
  } finally {
    await page.unroute('**/v1/search?**'); page.off('pageerror', onError);
  }
}
