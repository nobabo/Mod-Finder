// Playwright CLI: run-code --filename tooling/scripts/verify-character-art.js
async (page) => {
  const base = new URL(page.url()).origin;
  const games = ['minecraft-java','stardew-valley','skyrim-se','lethal-company','rimworld','valheim','terraria','project-zomboid','cyberpunk-2077','baldurs-gate-3','fallout-4','risk-of-rain-2','cities-skylines','dont-starve-together'];
  const check = (condition,message) => {if(!condition) throw Error(message);};
  const reports = [], errors = [];
  for(const width of [1536,390,320]) {
    const context = await page.context().browser().newContext({viewport:{width,height:width===1536?960:844},reducedMotion:'reduce'});
    try {
      await context.addInitScript(()=>{document.cookie='mf-language=ko; Path=/';localStorage.setItem('modfinder-intro-seen','1');});
      const tab = await context.newPage();
      tab.on('pageerror',error=>errors.push(error.message));
      const inspect = () => tab.evaluate(()=>{
        const search = document.querySelector('.search-box').getBoundingClientRect();
        const filter = document.querySelector('.filter-orb').getBoundingClientRect();
        const overlap = (a,b)=>a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
        const buttons = [...document.querySelectorAll('.movable-artwork')];
        return {count:buttons.length,clear:buttons.every(button=>!overlap(button.getBoundingClientRect(),search)&&!overlap(button.getBoundingClientRect(),filter)),visible:buttons.every(button=>{const box=button.getBoundingClientRect();return box.width>0 && box.height>0 && box.left>=0 && box.right<=innerWidth && box.top>=0 && box.bottom<=innerHeight;}),sources:buttons.map(button=>button.querySelector('img').getAttribute('src')),ids:[...document.querySelectorAll('[data-artwork-id]')].map(el=>el.dataset.artworkId),overflow:document.documentElement.scrollWidth>innerWidth};
      });
      for(const game of games) {
        await tab.goto(`${base}/?game=${game}`);
        await tab.locator('.game-characters-search').waitFor();
        await tab.locator('.character-cutout img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
        await tab.evaluate(()=>document.fonts.ready);
        const report = await inspect();
        check(report.count===2,`${game}/${width}: exactly two elements`);
        check(report.sources.every(src=>src.startsWith('/theme-art/')),`${game}: character/mob/item images replace title wordmarks`);
        check(report.clear && report.visible && !report.overflow,`${game}/${width}: search stays clear and both elements remain in view ${JSON.stringify(report)}`);
        if(game==='minecraft-java') check(report.ids.join('|')==='minecraft-java:steve|minecraft-java:diamond','Minecraft keeps only Steve and diamond');
        if(width===1536 || game==='minecraft-java') await tab.screenshot({path:`output/playwright/${game}-${width}-two-elements.png`});
        reports.push({game,width,count:2,searchClear:true});
      }
      if(width===1536) {
        await tab.goto(`${base}/?game=minecraft-java`);
        const steve = tab.getByRole('button',{name:'이미지 이동: 마인크래프트 스티브',exact:true});
        await steve.waitFor();
        const from = await steve.boundingBox(), target = await tab.locator('.search-box').boundingBox();
        await tab.mouse.move(from.x+from.width/2,from.y+from.height/2); await tab.mouse.down();
        await tab.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:16});
        check((await inspect()).clear,'Dragging over the search field is constrained immediately');
        await tab.mouse.up();
        await tab.reload(); await steve.waitFor();
        check((await inspect()).clear,'Saved drags remain clear after reload');
        await tab.setViewportSize({width:320,height:740});
        await tab.waitForFunction(()=>document.querySelector('.search-box').getBoundingClientRect().width<320);
        check((await inspect()).clear,'Resize keeps saved artwork clear');
        await tab.evaluate(()=>{
          localStorage.setItem('modfinder-artwork:minecraft-java:steve',JSON.stringify({x:.5,y:.4}));
          localStorage.setItem('modfinder-artwork:minecraft-java:alex',JSON.stringify({x:.5,y:.5}));
        });
        await tab.reload(); await steve.waitFor();
        const legacy = await inspect();
        check(legacy.clear && legacy.count===2 && legacy.ids.every(id=>!id.endsWith(':alex')),'Old saved positions are corrected and removed characters stay absent');
        await tab.locator('#mod-query').click();
        check(await tab.locator('#mod-query').evaluate(el=>el===document.activeElement),'Search remains directly clickable');
      }
    } finally {await context.close();}
  }
  check(errors.length===0,errors.join(', '));
  return {passed:true,reports,dragClearance:true,restoredClearance:true,legacyPositions:true,errors};
}
