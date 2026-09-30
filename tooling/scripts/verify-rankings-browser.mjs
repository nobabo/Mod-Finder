async (page) => {
  const games = [['마인크래프트', true], ['스타듀 밸리', true], ['스카이림', true], ['리썰 컴퍼니', true], ['림월드', true], ['발헤임', true], ['테라리아', true], ['프로젝트 좀보이드', true], ['사이버펑크 2077', true], ['발더스 게이트 3', true], ['폴아웃 4', true], ['리스크 오브 레인 2', true], ['시티즈: 스카이라인', false], ['돈 스타브 투게더', false]];
  for (const [name, hasSearch] of games) {
    await page.getByRole('button', { name: '게임 바꾸기', exact: true }).click();
    await page.getByRole('dialog', { name: '게임 선택', exact: true }).getByRole('button', { name, exact: true }).click();
    const group = page.getByRole('group', { name: '순위 종류', exact: true });
    await group.waitFor();
    const count = await group.getByRole('button', { name: '검색 순위', exact: true }).count();
    if (count !== Number(hasSearch)) throw Error(name + ': wrong tabs');
    if (hasSearch) {
      const first = await page.locator('.ranking-list strong').first().textContent();
      if (!first || (name !== '마인크래프트' && first === '선릿 밸리')) throw Error(name + ': wrong community');
      console.log(JSON.stringify({ game: name, search: true, first }));
    } else {
      await page.locator('.ranked-grid > li').first().waitFor({ timeout: 25000 });
      console.log(JSON.stringify({ game: name, search: false, items: await page.locator('.ranked-grid > li').count() }));
    }
  }
  await page.screenshot({ path: 'output/playwright/no-mod-tab-rankings.png', fullPage: true });
  await page.getByRole('button', { name: '게임 바꾸기', exact: true }).click();
  await page.getByRole('dialog', { name: '게임 선택', exact: true }).getByRole('button', { name: '스타듀 밸리', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/stardew-search-ranking.png', fullPage: true });
  await page.getByRole('button', { name: '다운로드 순위', exact: true }).click();
  await page.locator('.ranked-grid > li').first().waitFor({ timeout: 25000 });
  if (await page.locator('.ranked-grid > li').count() !== 10) throw Error('Download page should contain ten items');
  await page.screenshot({ path: 'output/playwright/stardew-download-ranking.png', fullPage: true });
  await page.getByRole('button', { name: '다음 페이지', exact: true }).click();
  if (!(await page.locator('.ranking-pagination').textContent()).includes('2 / 3')) throw Error('Download pagination failed');
  await page.getByRole('button', { name: '검색 순위', exact: true }).click();
  const searched = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname === '/v1/search' && url.searchParams.get('gameId') === 'stardew-valley' && url.searchParams.get('query') === 'Ridgeside Village';
  });
  await page.getByRole('button', { name: '02 릿지사이드 빌리지', exact: true }).click();
  const request = new URL((await searched).url());
  if (request.searchParams.has('kind')) throw Error('Minecraft modpack filter leaked into Stardew');
  if (await page.getByRole('textbox', { name: '모드 검색어', exact: true }).inputValue() !== 'Ridgeside Village') throw Error('Wrong search term');
  console.log('All 14 game tabs, download pagination and community search routing passed.');
}
