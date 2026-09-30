async(page)=>{
 const check=(v,m)=>{if(!v)throw Error(m)};await page.setViewportSize({width:1375,height:768});await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{localStorage.setItem('modfinder-intro-seen','1');document.cookie='mf-language=ko; Path=/';});await page.reload();
 if(await page.locator('.settings-fab').isVisible())await page.locator('.settings-fab').click();else await page.getByRole('navigation',{name:'모바일 메뉴'}).getByRole('button',{name:'설정',exact:true}).click();await page.mouse.move(687,50);await page.waitForTimeout(500);
 const symmetry=await page.evaluate(()=>{const cards=[...document.querySelectorAll('.settings-rail nav>*')],c=cards.map(e=>({x:e.getBoundingClientRect().x,w:e.getBoundingClientRect().width,drop:parseFloat(e.style.getPropertyValue('--card-drop')),turn:parseFloat(e.style.getPropertyValue('--card-turn'))}));const title=document.querySelector('.settings-deck-header h2').getBoundingClientRect();return{cards:c,titleCenter:title.x+title.width/2,viewport:innerWidth}});
 check(Math.abs(symmetry.titleCenter-symmetry.viewport/2)<1,'Centered title');for(let i=0;i<3;i++){const a=symmetry.cards[i],b=symmetry.cards[5-i];check(Math.abs(a.drop-b.drop)<.1,'Symmetric height');check(Math.abs(a.turn+b.turn)<.1,'Symmetric tilt');}
 await page.screenshot({path:'output/playwright/settings-motion-fixed.png'});
 await page.getByRole('dialog',{name:'설정 메뉴',exact:true}).getByRole('button',{name:'즐겨찾기',exact:true}).click();
 const returnHome=async()=>{await page.getByRole('button',{name:'메인 화면으로 이동',exact:true}).click();await page.locator('.search-dock.hero').waitFor();check(await page.getByRole('dialog').count()===0,'No home confirmation');check(await page.getByRole('textbox',{name:'모드 검색어'}).inputValue()==='','Search cleared');check(await page.locator('.home-logo').count()===0,'Home reached');};
 await returnHome();
 for(const width of [1375,390]){
  await page.setViewportSize({width,height:768});
  for(const section of ['최근 기록','즐겨찾기']){
   if(await page.locator('.settings-fab').isVisible())await page.locator('.settings-fab').click();else await page.getByRole('navigation',{name:'모바일 메뉴'}).getByRole('button',{name:'설정',exact:true}).click();
   await page.getByRole('dialog',{name:'설정 메뉴',exact:true}).getByRole('button',{name:section,exact:true}).click();await returnHome();
  }
  await page.getByRole('textbox',{name:'모드 검색어'}).fill('sodium');await page.getByRole('button',{name:'모드 검색',exact:true}).click();await returnHome();
  await page.screenshot({path:`output/playwright/direct-home-${width}.png`});
 }
 return {symmetry,directHome:true};
}