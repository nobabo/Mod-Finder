// Run in a dedicated Playwright CLI session: run-code --filename=scripts/verify-ui.js
async (page) => {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  await page.evaluate(() => { localStorage.clear(); document.cookie = 'mf-language=ko; Path=/; SameSite=Lax'; });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/v1/search?**', async route => {
    const params = Object.fromEntries(route.request().url().split('?')[1].split('&').map(pair => pair.split('=').map(decodeURIComponent)));
    const make = (id, title, summary, rank) => ({ key: 'modrinth:minecraft:' + id, source: 'modrinth', scope: 'minecraft', id, gameId: 'minecraft-java', title, summary, rank, author: 'UI verification', url: 'https://modrinth.com/mod/sodium', iconUrl: null, updatedAt: null, versions: null, loaders: null, kind: 'mod', metrics: [{ label: '다운로드', value: rank }], tags: [], fetchedAt: new Date().toISOString() });
    const primary = params.source === 'modrinth';
    const next = !!params.cursor;
    const items = !primary ? [] : next ? [make('qa-both', 'Magic Tools', 'Magic utilities', 99)] : [make('qa-description', 'Utilities', 'Adds magic', 1), make('qa-title', 'Magic', 'Utility collection', 2)];
    await route.fulfill({ json: { source: params.source, status: items.length ? 'success' : 'empty', items, nextCursor: primary && !next ? 'next' : null, total: primary ? 3 : 0, fetchedAt: new Date().toISOString(), cached: false, appliedFilters: {}, unsupportedFilters: [], externalUrl: null, queryForwarded: true, message: '검색 완료' } });
  });
  try {
    await page.reload();
    await page.locator('#mod-query').fill('magic');
    await page.locator('#mod-query').press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.mod-card').length === 3);
    assert((await page.locator('.title-button').allTextContents()).join('|') === 'Magic Tools|Magic|Utilities', 'Priority across automatic pages');
    assert(await page.locator('.source-tabs,.results-heading,.card-bottom').count() === 0, 'Obsolete UI returned');
    await page.getByRole('button', { name: '검색 필터', exact: true }).click();
    await page.getByRole('button', { name: '장르', exact: true }).click();
    await page.getByRole('combobox', { name: '모드 로더', exact: true }).selectOption('fabric');
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.mod-card').length === 3);
    await page.evaluate(() => { window.__originalOpen = window.open; window.open = url => { window.__openedUrl = url; return null; }; });
    await page.locator('.mod-logo-link').first().click();
    assert(await page.evaluate(() => window.__openedUrl) === 'https://modrinth.com/mod/sodium', 'Original link');
    await page.locator('.title-button').first().click();
    await page.locator('.sheet').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Magic Tools 즐겨찾기', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('modfinder:local:v1')).favorites.length === 1);
    const icon = await page.locator('.game-orb').innerHTML();
    await page.getByRole('button', { name: '설정 메뉴', exact: true }).click();
    await page.getByRole('dialog', { name: '설정 메뉴' }).waitFor();
    assert(await page.locator('#mod-query').getAttribute('placeholder') === '검색할 모드를 입력하세요.', 'Settings placeholder');
    assert(await page.locator('.game-orb').innerHTML() === icon, 'Settings game icon');
    await page.keyboard.press('Escape');
    await page.screenshot({ path: 'output/playwright/clean-results-desktop.png' });
    await page.reload();
    assert(await page.evaluate(() => JSON.parse(localStorage.getItem('modfinder:local:v1')).favorites.length) === 1, 'Saved favorite');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#mod-query').fill('magic');
    await page.locator('#mod-query').press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.mod-card').length === 3);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
    await page.screenshot({ path: 'output/playwright/clean-results-mobile.png' });
    assert(errors.length === 0, errors.join('\n'));
    return { passed: ['search ordering and pagination', 'filters', 'source link and details', 'favorites persistence', 'settings preserve search', 'mobile layout'], pageErrors: errors };
  } finally {
    await page.unrouteAll();
    await page.evaluate(() => { if (window.__originalOpen) window.open = window.__originalOpen; });
    page.off('pageerror', onError);
  }
}


