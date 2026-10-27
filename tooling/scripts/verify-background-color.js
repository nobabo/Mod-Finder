// Playwright CLI: --filename tooling/scripts/verify-background-color.js
async (page) => {
  const base = new URL(page.url()).origin;
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const reports = [];
  for (const mobile of [false,true]) {
    const context = await page.context().browser().newContext({viewport:{width:mobile?390:1536,height:mobile?844:960},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
    try {
      await context.addInitScript(()=>{document.cookie='mf-language=ko; Path=/';localStorage.setItem('modfinder-intro-seen','1');});
      const tab = await context.newPage(), errors = [];
      tab.on('pageerror',error=>errors.push(error.message));
      const button = name => tab.getByRole('button',{name,exact:true});
      const picker = () => tab.getByRole('dialog',{name:'배경색',exact:true});
      const openTheme = async()=>{await button('설정 메뉴').click();await button('테마').click();};
      const openPicker = async()=>{await button('색상 선택').click();await picker().waitFor();await picker().locator('.glass-control-surface').waitFor({state:'visible'});};
      const stored = () => tab.evaluate(()=>localStorage.getItem('modfinder-background-color'));
      const choose = async hex => {await picker().getByRole('textbox',{name:'HEX',exact:true}).fill(hex);await tab.waitForFunction(value=>localStorage.getItem('modfinder-background-color')===value,hex);};
      const lensHash = () => picker().locator('.glass-control-surface').evaluate(lens=>{const pixels=lens.getContext('2d').getImageData(0,0,lens.width,lens.height).data;let hash=1;for(let i=0;i<pixels.length;i+=97)hash=Math.imul(hash,31)+pixels[i]|0;return hash;});
      for(const [game,defaultColor,halfColor] of [['minecraft-java','#14251f','#122329'],['stardew-valley','#29221c','#1d2228']]) {
        await tab.goto(`${base}/?game=${game}`);await tab.locator('.atmosphere.is-ready').waitFor();await openTheme();
        check(await tab.locator('.theme-options button').count()===2,'Two theme presets');
        check(await button('기본 색상으로').isDisabled(),'No override initially');
        await openPicker();
        check(await tab.locator('input[type=color]').count()===0,'No native OS color picker');
        check(await picker().getByRole('textbox',{name:'HEX',exact:true}).inputValue()===defaultColor,'Picker reflects game default');
        check(await picker().getByRole('slider',{name:'채도와 명도',exact:true}).evaluate(el=>el===document.activeElement),'Picker receives keyboard focus');
        const square=picker().getByRole('slider',{name:'채도와 명도',exact:true});
        const box=await square.boundingBox();
        if(mobile) await tab.touchscreen.tap(box.x+box.width*.7,box.y+box.height*.3);
        else {await tab.mouse.move(box.x+box.width*.2,box.y+box.height*.3);await tab.mouse.down();await tab.mouse.move(box.x+box.width*.8,box.y+box.height*.2,{steps:8});await tab.mouse.up();}
        check(await stored()!==null,'Pointer selection saves a color');
        await square.focus();const before=await square.getAttribute('aria-valuetext');await tab.keyboard.press('Shift+ArrowLeft');
        check(await square.getAttribute('aria-valuetext')!==before,'Selection square supports keyboard');
        const hue=picker().getByRole('slider',{name:'색조',exact:true});await hue.focus();await hue.press('Home');await hue.press('ArrowRight');
        check(await hue.inputValue()==='1','Hue slider supports keyboard');
        await choose('#e5d0b0');check(await tab.locator('html').getAttribute('data-light-theme')==='true','Opaque light color adapts text');
        const hash=await lensHash();
        for(const [channel,value] of [['R','17'],['G','34'],['B','51'],['A','0.5']]) await picker().getByRole('spinbutton',{name:channel,exact:true}).fill(value);
        await tab.waitForFunction(()=>localStorage.getItem('modfinder-background-color')==='#11223380');
        check(await tab.locator('html').evaluate((el,color)=>el.style.getPropertyValue('--canvas')===color,halfColor),'RGBA alpha composites over the actual game default');
        await tab.waitForFunction(old=>{const lens=document.querySelector('.color-picker>.glass-control-surface'),pixels=lens.getContext('2d').getImageData(0,0,lens.width,lens.height).data;let next=1;for(let i=0;i<pixels.length;i+=97)next=Math.imul(next,31)+pixels[i]|0;return next!==old;},hash);
        await tab.screenshot({path:`output/playwright/${game}-${mobile?'mobile':'desktop'}-rgba-picker.png`});
        const hex=picker().getByRole('textbox',{name:'HEX',exact:true});await hex.fill('#bad');await hex.press('Tab');
        check(await stored()==='#11223380' && await hex.inputValue()==='#11223380','Invalid draft does not replace saved color');
        await hex.focus();await hex.press('Tab');check(await picker().getByRole('button',{name:'닫기',exact:true}).evaluate(el=>el===document.activeElement),'Tab remains inside picker');
        await tab.keyboard.press('Escape');check(await picker().count()===0 && await tab.locator('.theme-settings').isVisible(),'Escape closes only picker');
        check(await button('색상 선택').evaluate(el=>el===document.activeElement),'Focus returns to swatch');
        await button('닫기').click();await tab.reload();await tab.locator('.atmosphere.is-ready').waitFor();await openTheme();await openPicker();
        check(await picker().getByRole('textbox',{name:'HEX',exact:true}).inputValue()==='#11223380','RGBA survives reload');
        await choose('#ffffff00');check(await tab.locator('html').evaluate((el,color)=>el.style.getPropertyValue('--canvas')===color,defaultColor),'Fully transparent color restores base game canvas');
        check(await tab.locator('html').getAttribute('data-light-theme')===null,'Transparent white keeps dark text scheme');
        await picker().getByRole('button',{name:'닫기',exact:true}).click();await button('크림슨').click();await openPicker();
        check(!await tab.locator('.atmosphere').evaluate(el=>el.classList.contains('game-atmosphere')),'Transparent Crimson keeps original photographic scene');
        await choose('#ffffff80');await picker().getByRole('button',{name:'닫기',exact:true}).click();
        await button('기본 색상으로').click();await tab.waitForFunction(()=>localStorage.getItem('modfinder-background-color')===null);
        await button('게임 기본').click();await openPicker();
        if(mobile){await tab.setViewportSize({width:320,height:740});check(await picker().evaluate(el=>el.getBoundingClientRect().right<=innerWidth),'Picker fits 320px mobile');await tab.screenshot({path:`output/playwright/${game}-narrow-rgba-picker.png`});await tab.setViewportSize({width:390,height:844});}
        await tab.mouse.click(2,2);check(await picker().count()===0,'Backdrop dismisses picker');
        check(!await tab.locator('html').evaluate(el=>el.scrollWidth>innerWidth),'No horizontal overflow');
        await button('닫기').click();
        reports.push({game,mobile,customDialog:true,rgba:true,liveRefraction:true,pointer:true,keyboard:true,persistent:true,alphaZero:true,reset:true});
      }
      check(errors.length===0,errors.join('\n'));
    } finally {await context.close();}
  }
  return {passed:true,reports};
}
