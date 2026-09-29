async(page)=>{
 const check=(v,m)=>{if(!v)throw Error(m)};
 await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{localStorage.clear();localStorage.setItem('modfinder-intro-seen','1');document.cookie='mf-language=ko; Path=/';});
 const item={key:'curseforge:432:285109',source:'curseforge',scope:'432',id:'285109',gameId:'minecraft-java',title:'RLCraft',summary:'API-only description',rank:1,author:'Test',url:'https://www.curseforge.com/minecraft/modpacks/rlcraft',iconUrl:null,updatedAt:null,versions:null,loaders:null,kind:'modpack',metrics:[{label:'다운로드',value:1234}],tags:[],fetchedAt:new Date().toISOString()};
 let offline=false;
 await page.route('**/v1/listings/**',route=>offline?route.fulfill({status:503,json:{error:'offline'}}):route.fulfill({json:{listing:item}}));
 await page.route('**/v1/search?**',route=>{const source=new URL(route.request().url()).searchParams.get('source');const items=source==='curseforge'?[item]:[];return route.fulfill({json:{source,status:items.length?'success':'empty',items,nextCursor:null,total:items.length,fetchedAt:item.fetchedAt,cached:false,appliedFilters:{},unsupportedFilters:[],externalUrl:null,queryForwarded:true,message:''}})});
 const menu=async name=>{await page.getByRole('button',{name:'설정 메뉴',exact:true}).click();await page.getByRole('dialog',{name:'설정 메뉴',exact:true}).getByRole('button',{name,exact:true}).click()};
 try{
 await page.reload();await page.getByRole('button',{name:'다운로드 순위',exact:true}).click();await page.getByRole('button',{name:'RLCraft 즐겨찾기',exact:true}).click();
 await menu('즐겨찾기');await page.getByRole('button',{name:'새 폴더',exact:true}).click();await page.getByLabel('폴더명',{exact:true}).fill('기술');await page.getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('button',{name:'전체',exact:true}).click();await page.getByRole('button',{name:'RLCraft 폴더로 이동',exact:true}).click();await page.getByRole('dialog',{name:'폴더로 이동',exact:true}).getByRole('button',{name:'기술',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('modfinder:local:v1')).folders[0].keys.length===1);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('modfinder:local:v1')));check(saved.favorites[0].referenceOnly===true,'Reference saved');check(!('title'in saved.favorites[0]),'No cached API title');
 await page.reload();await menu('즐겨찾기');await page.getByRole('button',{name:'기술',exact:true}).click();await page.getByRole('button',{name:'RLCraft 즐겨찾기 해제',exact:true}).waitFor();
 const box=await page.locator('.collection-panel').boundingBox(),search=await page.locator('.search-dock').boundingBox(),option=await page.locator('.settings-fab').boundingBox();check(Math.abs(box.y+box.height/2-500)<2,'Centered favorites');check(search.y+search.height<box.y,'Search above favorites');check(Math.abs(option.y+option.height/2-500)<2,'Option at midpoint');check(await page.locator('.collection-panel').evaluate(e=>getComputedStyle(e).backgroundColor)==='rgba(0, 0, 0, 0)','Transparent favorites');
 await page.screenshot({path:'output/playwright/centered-favorites.png'});
 await page.getByRole('button',{name:'설정 메뉴',exact:true}).click();await page.mouse.move(720,100);
 const cards=page.locator('.settings-rail nav').locator('button,a');const left=await cards.nth(2).boundingBox(),right=await cards.nth(3).boundingBox();check(Math.abs((left.x+left.width+right.x)/2-720)<3,'Menu centered between history and theme');await page.screenshot({path:'output/playwright/balanced-settings.png'});await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.locator('#mod-query').fill('test');await page.locator('#mod-query').press('Enter');await menu('최근 기록');
 const stage=await page.locator('.collection-stage').boundingBox();check(Math.abs(stage.y+stage.height/2-500)<2,'Centered history');check(await page.locator('.history-list').evaluate(e=>getComputedStyle(e).backgroundColor)==='rgba(0, 0, 0, 0)','Transparent history');await page.screenshot({path:'output/playwright/centered-history.png'});
 offline=true;await page.reload();await menu('즐겨찾기');await page.getByRole('button',{name:'기술',exact:true}).click();check(await page.locator('.mod-card').count()===1,'Offline reference retained');await page.locator('.mod-card .save-button').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('modfinder:local:v1')).favorites.length===0);
 return {passed:['CurseForge save, folder, reload, unsave','reference-only persistence','offline bookmark retained','transparent centered collections','fixed options','balanced six-card menu']};
 }finally{await page.unrouteAll()}
}
