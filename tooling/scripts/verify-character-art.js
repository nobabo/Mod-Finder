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
        const buttons = [...document.querySelectorAll('.movable-artwork')];
        const left = buttons[0].getBoundingClientRect(), right = buttons[1].getBoundingClientRect();
        const above = selector => {const el=document.querySelector(selector),box=el.getBoundingClientRect();return el.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));};
        return {count:buttons.length,controlsAbove:above('#mod-query')&&above('.filter-orb')&&above('.ranking-tabs button'),corners:left.left<search.left && left.right<search.left+search.width*.5 && Math.abs(left.bottom-search.top)<5 && right.left>search.left+search.width*.6 && Math.abs(right.top-search.bottom)<8,brandTop:document.querySelector('.app-brand-header').getBoundingClientRect().top,visible:buttons.every(button=>{const box=button.getBoundingClientRect();return box.width>0 && box.height>0 && box.left>=0 && box.right<=innerWidth && box.top>=0 && box.bottom<=innerHeight;}),sources:buttons.map(button=>button.querySelector('img').getAttribute('src')),ids:[...document.querySelectorAll('[data-artwork-id]')].map(el=>el.dataset.artworkId),overflow:document.documentElement.scrollWidth>innerWidth};
      });
      for(const game of games) {
        await tab.goto(`${base}/?game=${game}`);
        await tab.locator('.game-characters-search').waitFor();
        await tab.locator('.character-cutout img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
        await tab.evaluate(()=>document.fonts.ready);
        const report = await inspect();
        check(report.count===2,`${game}/${width}: exactly two elements`);
        check(report.sources.every(src=>src.startsWith('/theme-art/')),`${game}: character/mob/item images replace title wordmarks`);
        check(report.controlsAbove && report.corners && report.brandTop===56 && report.visible && !report.overflow,`${game}/${width}: reference corners, lowered MF and usable controls ${JSON.stringify(report)}`);
        if(game==='minecraft-java') check(report.ids.join('|')==='minecraft-java:steve|minecraft-java:diamond','Minecraft keeps only Steve and diamond');
        if(width===1536 || game==='minecraft-java') await tab.screenshot({path:`output/playwright/${game}-${width}-two-elements.png`});
        reports.push({game,width,count:2,referenceCorners:true,controlsAbove:true,brandTop:56});
      }
      for (const game of ['minecraft-java','skyrim-se']) {
        await tab.goto(`${base}/?game=${game}`);
        await tab.locator('.game-characters-search').waitFor();
        await tab.locator('.character-cutout img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
        const id = await tab.locator('.game-characters-search .is-representative').getAttribute('data-artwork-id');
        const art = tab.locator(`[data-artwork-position="${id}"] button,[data-artwork-id="${id}"]>button`);
        const reset = async () => {await art.focus();await tab.keyboard.press('Home');};
        const dragTo = async (left,top,release=true) => {
          const from = await art.boundingBox();
          const point = await art.evaluate(el=>{
            const box=el.getBoundingClientRect();
            for(const y of [.1,.3,.5,.7,.9]) for(const x of [.1,.3,.5,.7,.9]) {
              const point={x:box.x+box.width*x,y:box.y+box.height*y};
              if(el.contains(document.elementFromPoint(point.x,point.y))) return point;
            }
          });
          check(point,`${game}/${width}: exposed artwork can be picked up`);
          await tab.mouse.move(point.x,point.y);await tab.mouse.down();
          await tab.mouse.move(point.x+left-from.x,point.y+top-from.y,{steps:12});
          const box=await art.boundingBox();
          const viewport=tab.viewportSize();
          check(Math.abs(box.x-Math.max(8,Math.min(viewport.width-from.width-8,left)))<2 && Math.abs(box.y-Math.max(8,Math.min(viewport.height-from.height-8,top)))<2,`${game}/${width}: follows the pointer through controls without snapping ${JSON.stringify({box,left,top})}`);
          if(release) await tab.mouse.up();
        };
        const controlAbove = async selector => tab.locator(selector).first().evaluate((control,id)=>{
          const art=document.querySelector(`[data-artwork-position="${id}"] button`);
          const a=art.getBoundingClientRect(), b=control.getBoundingClientRect();
          const left=Math.max(a.left,b.left),right=Math.min(a.right,b.right),top=Math.max(a.top,b.top),bottom=Math.min(a.bottom,b.bottom);
          return right>left && bottom>top && control.contains(document.elementFromPoint((left+right)/2,(top+bottom)/2));
        },id);
        const search=await tab.locator('.search-box').boundingBox(), input=await tab.locator('#mod-query').boundingBox(), size=await art.boundingBox();
        await dragTo(input.x+input.width/2-size.width/2,search.y-32,false);
        check(await controlAbove('#mod-query'),`${game}/${width}: input stays above artwork during a drag`);
        await tab.mouse.up();
        const saved=await art.boundingBox();
        await tab.screenshot({path:`output/playwright/${game}-${width}-artwork-behind-search.png`});
        await tab.locator('#mod-query').click();
        check(await tab.locator('#mod-query').evaluate(el=>el===document.activeElement),'Overlapping artwork does not block input');
        await tab.reload();await art.waitFor();
        const restored=await art.boundingBox();
        check(Math.abs(restored.x-saved.x)<2 && Math.abs(restored.y-saved.y)<2,'Reload preserves the chosen overlap');
        await art.focus();await tab.keyboard.press('ArrowRight');
        const keyboard=await art.boundingBox();
        check(Math.abs(keyboard.x-restored.x-8)<2 && Math.abs(keyboard.y-restored.y)<2,'Keyboard movement does not snap around the search field');
        check(await controlAbove('#mod-query'),'Input keeps priority after keyboard movement');

        for(const selector of ['.game-orb','.search-submit','.ranking-tabs button:last-child','.filter-orb','.settings-fab','.app-brand-header .home-logo']) {
          await reset();
          const target=await tab.locator(selector).first().boundingBox();
          await dragTo(target.x+target.width/2-size.width/2,target.y+target.height/2-size.height/2,false);
          check(await controlAbove(selector),`${game}/${width}: ${selector} stays above dragging artwork`);
          await tab.mouse.up();
          check(await controlAbove(selector),`${game}/${width}: ${selector} stays above saved artwork`);
          if(selector==='.ranking-tabs button:last-child') {
            await tab.locator(selector).click();
            check(await tab.locator(selector).getAttribute('aria-pressed')==='true','Ranking tab remains clickable');
          }
          if(selector==='.filter-orb' || selector==='.settings-fab' || selector==='.game-orb') {
            await tab.locator(selector).click();
            await tab.getByRole('dialog').waitFor();
            check(await art.isDisabled(),'Dialog pauses background artwork');
            await tab.getByRole('button',{name:'닫기',exact:true}).click();
          }
        }
        await reset();
        const ranking=await tab.locator('.ranking-panel').boundingBox();
        await dragTo(ranking.x+20,search.y+search.height+2);
        const gap=await art.evaluate(el=>{const box=el.getBoundingClientRect();return el.contains(document.elementFromPoint(box.x+box.width/2,box.y+4));});
        check(gap,'Empty space near controls lets exposed artwork remain draggable');
        await dragTo(ranking.x+32,search.y+search.height+3);
        if(width<1401) {
          await reset();
          await dragTo(width*.25-size.width/2,8);
          await dragTo(width*.25-size.width/2+12,16);
        }
        reports.push({game,width,freeOverlap:true,controlsAbove:true,gapsDraggable:true});
      }
    } finally {await context.close();}
  }
  check(errors.length===0,errors.join(', '));
  return {passed:true,reports,freeOverlap:true,restoredOverlap:true,controlsAbove:true,errors};
}
