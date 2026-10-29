// Playwright CLI: run-code --filename tooling/scripts/verify-game-default-colors.js
async (page) => {
  const base = new URL(page.url()).origin;
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const defaults = [
    ['minecraft-java', '#1864524d'], ['stardew-valley', '#5035154d'], ['skyrim-se', '#27465f4d'],
    ['lethal-company', '#722d244d'], ['rimworld', '#4437624d'], ['valheim', '#2852484d'],
    ['terraria', '#356f294d'], ['project-zomboid', '#4c54284d'], ['cyberpunk-2077', '#8a741a4d'],
    ['baldurs-gate-3', '#6542224d'], ['fallout-4', '#214d764d'], ['risk-of-rain-2', '#1f64764d'],
    ['cities-skylines', '#164e634d'], ['dont-starve-together', '#59432d4d'],
  ];
  const context = await page.context().browser().newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'reduce' });
  try {
    await context.addInitScript(() => {
      document.cookie = 'mf-language=ko; Path=/';
      localStorage.setItem('modfinder-intro-seen', '1');
    });
    const tab = await context.newPage();
    const errors = [], reports = [];
    tab.on('pageerror', error => errors.push(error.message));
    const button = name => tab.getByRole('button', { name, exact: true });
    const picker = () => tab.getByRole('dialog', { name: '배경색', exact: true });
    const openPicker = async () => {
      await button('설정 메뉴').click(); await button('테마').click(); await button('커스텀 색상').click();
    };
    for (const [game, color] of defaults) {
      await tab.goto(`${base}/?game=${game}`);
      await tab.locator('.atmosphere.is-ready').waitFor();
      await tab.waitForFunction(expected => Math.abs(Number(document.querySelector('.atmosphere').dataset.photoAlpha) - expected) < .001, parseInt(color.slice(7,9),16) / 255);
      await openPicker();
      check(await picker().getByRole('textbox', { name: 'HEX', exact: true }).inputValue() === color, `${game}: color picker uses the exact RGBA default`);
      check((await button('기본 색상').getAttribute('aria-pressed')) === 'true', `${game}: no custom color is needed`);
      check(await tab.evaluate(() => localStorage.getItem('modfinder-background-color')) === null, `${game}: default is not stored as an override`);
      await tab.screenshot({ path: `output/playwright/${game}-default-picker.png` });
      await picker().getByRole('button', { name: '닫기', exact: true }).click();
      await button('닫기').click();
      await tab.screenshot({ path: `output/playwright/${game}-default-theme.png` });
      const palette = await tab.locator('html').evaluate(el => ({ accent: el.style.getPropertyValue('--accent'), text: el.style.getPropertyValue('--text') }));
      reports.push({ game, color, ...palette });
    }
    // A saved manual color still wins; resetting restores the current game's default.
    await openPicker();
    await picker().getByRole('textbox', { name: 'HEX', exact: true }).fill('#20304080');
    await tab.waitForFunction(() => localStorage.getItem('modfinder-background-color') === '#20304080');
    await tab.goto(`${base}/?game=skyrim-se`);
    await tab.locator('.atmosphere.is-ready').waitFor();
    await openPicker();
    check(await picker().getByRole('textbox', { name: 'HEX', exact: true }).inputValue() === '#20304080', 'A saved manual color survives switching games');
    await picker().getByRole('button', { name: '닫기', exact: true }).click();
    await button('기본 색상').click();
    await button('커스텀 색상').click();
    check(await picker().getByRole('textbox', { name: 'HEX', exact: true }).inputValue() === '#27465f4d', 'Reset restores the current game default');
    await tab.reload();
    await tab.locator('.atmosphere.is-ready').waitFor();
    await openPicker();
    check(await picker().getByRole('textbox', { name: 'HEX', exact: true }).inputValue() === '#27465f4d', 'Reset survives reload');
    check(errors.length === 0, errors.join(', '));
    return { passed: true, reports, override: true, reset: true, errors };
  } finally { await context.close(); }
}
