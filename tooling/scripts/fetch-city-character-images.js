// Run in a Playwright CLI browser; downloads preserve the original game PNGs.
async (page) => {
  const results = [];
  for (const [name,path] of [
    ['wind-turbine','3/3e/Wind_Turbine.png'], ['chirper','9/9a/Chirper_Surviving_Mars.png'],
  ]) {
    const url = `https://skylines.paradoxwikis.com/images/${path}`;
    await page.goto(url);
    await page.waitForFunction(() => document.contentType === 'image/png' && document.images[0]?.naturalWidth > 0);
    const size = await page.evaluate(() => ({width:document.images[0].naturalWidth,height:document.images[0].naturalHeight}));
    const pending = page.waitForEvent('download');
    await page.evaluate(() => {
      const link = document.createElement('a'); link.href = location.href; link.download = 'game-art.png'; link.click();
    });
    const download = await pending;
    await download.saveAs(`output/artwork/cities-skylines-${name}.png`);
    results.push({name,url,...size});
  }
  return results;
}
