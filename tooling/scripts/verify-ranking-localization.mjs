// Run with Playwright CLI run-code --filename against a Korean Mod Finder page.
async (page) => {
  // Local preview relays the real production response through Playwright's transport.
  // Production CORS intentionally does not permit the development preview origin.
  if (new URL(page.url()).hostname === 'localhost') {
    await page.route('https://modfinder.pages.dev/v1/search?**', async route => {
      const response = await route.fetch({ headers: { ...route.request().headers(), origin: 'https://modfinder.pages.dev' } });
      await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': new URL(page.url()).origin } });
    });
  }
  const games = [
    ['stardew-valley', '스타듀 밸리'], ['skyrim-se', '스카이림'],
    ['lethal-company', '리썰 컴퍼니'], ['rimworld', '림월드'],
    ['valheim', '발헤임'], ['terraria', '테라리아'],
    ['project-zomboid', '프로젝트 좀보이드'], ['cyberpunk-2077', '사이버펑크 2077'],
    ['baldurs-gate-3', '발더스 게이트 3'], ['fallout-4', '폴아웃 4'],
    ['risk-of-rain-2', '리스크 오브 레인 2'], ['cities-skylines', '시티즈: 스카이라인'],
    ['dont-starve-together', '돈 스타브 투게더'],
  ];
  const unchanged = new Set(['r2modman', 'MonoDetour', 'R2API', 'Json.NET', 'YamlDotNet', 'JContainers SE', 'RED4ext', 'ENB', 'SKSE', 'LCMI', 'KORFACE', 'NAC X', 'PZ3D']);
  const assertNames = (names, context) => {
    if (!names.length || names.some(name => !/[가-힣]/.test(name) && !unchanged.has(name))) throw Error(context + ': unexpected untranslated names ' + names.join(', '));
  };
  for (const [id, name] of games) {
    await page.getByRole('button', { name: '게임 바꾸기', exact: true }).click();
    await page.getByRole('dialog', { name: '게임 선택', exact: true }).getByRole('button', { name, exact: true }).click();
    const search = page.getByRole('button', { name: '검색 순위', exact: true });
    if (await search.count()) assertNames(await page.locator('.ranking-list strong').allTextContents(), name + ' community');
    await page.getByRole('button', { name: id === 'rimworld' || id === 'terraria' || id === 'project-zomboid' || id === 'cities-skylines' || id === 'dont-starve-together' ? '구독 순위' : '다운로드 순위', exact: true }).click();
    await page.locator('.ranked-grid .title-button').first().waitFor({ timeout: 40000 });
    let count = 0;
    for (let index = 0; index < 3; index++) {
      const names = await page.locator('.ranked-grid .title-button').allTextContents();
      if (names.length !== 10) throw Error(name + ': expected ten items');
      assertNames(names, name + ' page ' + (index + 1));
      if (!(await page.locator('.ranking-pagination').textContent()).includes((index + 1) + ' / 3')) throw Error(name + ': pagination mismatch');
      count += names.length;
      if (index === 0 && ['stardew-valley', 'skyrim-se', 'lethal-company'].includes(id)) {
        await page.screenshot({ path: 'output/playwright/' + id + '-localized-ranking.png', fullPage: true });
      }
      if (id === 'lethal-company' && index === 0) {
        const tags = await page.locator('.ranked-grid .tags span').allTextContents();
        if (!tags.includes('베핀엑스') || tags.includes('BepInEx')) throw Error('BepInEx tag not localized');
      }
      if (index < 2) await page.getByRole('button', { name: '다음 페이지', exact: true }).click();
    }
    console.log(JSON.stringify({ game: id, checked: count }));
  }
  return 'Verified all 390 ranked titles, community titles, pagination and BepInEx tags.';
}
