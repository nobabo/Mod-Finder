// Playwright CLI: run-code --filename=tooling/scripts/verify-artwork-ripples.js
async (page) => {
  const base = new URL(page.url()).origin;
  const games = [
    'skyrim-se', 'lethal-company', 'rimworld', 'valheim', 'terraria', 'project-zomboid',
    'cyberpunk-2077', 'baldurs-gate-3', 'fallout-4', 'risk-of-rain-2', 'cities-skylines',
    'dont-starve-together', 'minecraft-java', 'stardew-valley',
  ];
  const reports = [];
  for (const mobile of [false, true]) {
    const context = await page.context().browser().newContext({
      viewport: { width: mobile ? 390 : 1000, height: mobile ? 844 : 800 },
      deviceScaleFactor: 1,
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: 'no-preference',
    });
    try {
      await context.addInitScript(() => {
        localStorage.setItem('modfinder-intro-seen', '1');
        document.cookie = 'mf-language=ko; Path=/';
      });
      const tab = await context.newPage();
      for (const game of games) {
        await tab.goto(`${base}/?game=${game}`);
        const characters = tab.locator('.game-characters-search .game-character');
        await characters.first().waitFor();
        if (await characters.count() !== 2) throw Error(`${game}: expected two character artworks`);
        // Isolate each ring so screenshot pixels reveal clipping rather than the foreground image.
        await tab.addStyleTag({ content: `
          body * { visibility:hidden !important; }
          .game-character[data-ripple-test] { position:fixed !important;left:50vw !important;top:50vh !important;right:auto !important;bottom:auto !important;transform:translate(-50%,-50%) !important;filter:none !important; }
          .game-character[data-ripple-test] .artwork-ripple { visibility:visible !important; }
          .game-character[data-ripple-test] .artwork-ripple::before,
          .game-character[data-ripple-test] .artwork-ripple::after { animation:none !important;opacity:0 !important; }
          .game-character[data-ripple-test="before"] .artwork-ripple::before,
          .game-character[data-ripple-test="after"] .artwork-ripple::after { opacity:1 !important;border-color:rgb(255,0,255) !important;transform:translate(-50%,-50%) scale(1.6) !important; }
        ` });
        for (let index = 0; index < 2; index++) {
          const character = characters.nth(index);
          for (const part of ['before', 'after']) {
            await character.evaluate((el, part) => el.setAttribute('data-ripple-test', part), part);
            const geometry = await character.evaluate((el, part) => {
              const ripple = el.querySelector('.artwork-ripple');
              const box = ripple.getBoundingClientRect();
              const style = getComputedStyle(ripple, `::${part}`);
              const border = style.boxSizing === 'border-box' ? 0 : parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
              return { x: box.left + parseFloat(style.left), y: box.top + parseFloat(style.top), radius: (parseFloat(style.width) + border) * 1.6 / 2 };
            }, part);
            const screenshot = await tab.screenshot();
            const missingAngles = await tab.evaluate(async ({ imageData, ...ring }) => {
              const image = new Image();
              image.src = `data:image/png;base64,${imageData}`;
              await image.decode();
              const canvas = document.createElement('canvas');
              canvas.width = image.width; canvas.height = image.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(image, 0, 0);
              const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const angles = Array(24).fill(false);
              for (let y = Math.max(0, Math.floor(ring.y - ring.radius - 6)); y < Math.min(height, ring.y + ring.radius + 6); y++) {
                for (let x = Math.max(0, Math.floor(ring.x - ring.radius - 6)); x < Math.min(width, ring.x + ring.radius + 6); x++) {
                  const i = (y * width + x) * 4;
                  if (data[i] < 220 || data[i + 1] > 45 || data[i + 2] < 220) continue;
                  const dx = x + .5 - ring.x, dy = y + .5 - ring.y;
                  if (Math.abs(Math.hypot(dx, dy) - ring.radius) > 6) continue;
                  const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
                  angles[Math.floor(angle / (Math.PI * 2) * angles.length)] = true;
                }
              }
              return angles.flatMap((visible, index) => visible ? [] : [index]);
            }, { imageData: screenshot.toString('base64'), ...geometry });
            if (missingAngles.length) {
              await tab.screenshot({ path: `output/playwright/ripple-failure-${game}-${mobile ? 'mobile' : 'desktop'}-${index}-${part}.png` });
              throw Error(`${game} ${mobile ? 'mobile' : 'desktop'} artwork ${index} ${part}: missing ring angles ${missingAngles.join(', ')}`);
            }
          }
          await character.evaluate(el => el.removeAttribute('data-ripple-test'));
        }
        reports.push({ game, mobile, completeRings: 4 });
      }
    } finally { await context.close(); }
  }
  return { passed: true, reports };
}
