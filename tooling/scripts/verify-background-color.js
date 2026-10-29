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
      const openPicker = async()=>{await button('색상 선택').click();await picker().waitFor();};
      const stored = () => tab.evaluate(()=>localStorage.getItem('modfinder-background-color'));
      const choose = async hex => {await picker().getByRole('textbox',{name:'HEX',exact:true}).fill(hex);await tab.waitForFunction(value=>localStorage.getItem('modfinder-background-color')===value,hex);};
      for(const [game,defaultColor] of [['minecraft-java','#186452b3'],['stardew-valley','#8a5a24b3']]) {
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
        const bright = await tab.locator('html').evaluate(el=>({text:el.style.getPropertyValue('--text'),accent:el.style.getPropertyValue('--accent')}));
        check(await picker().evaluate(el=>{const panel=el.querySelector('.color-picker'),style=getComputedStyle(panel),box=el.getBoundingClientRect();return style.backgroundColor==='rgba(0, 0, 0, 0)'&&style.backgroundImage==='none'&&style.backdropFilter.includes('blur')&&getComputedStyle(el).filter==='none'&&el.querySelectorAll('.glass-control-surface').length===0&&(innerWidth<=650||box.width>box.height);}), 'Wide transparent panel blurs only the backdrop');
        for(const [channel,value] of [['R','17'],['G','34'],['B','51'],['A','0.5']]) await picker().getByRole('spinbutton',{name:channel,exact:true}).fill(value);
        await tab.waitForFunction(()=>localStorage.getItem('modfinder-background-color')==='#11223380');
        check(await tab.evaluate(()=>{const average=document.querySelector('.atmosphere').dataset.photoAverage;const expected='#'+[1,3,5].map((at,index)=>Math.round(parseInt(average.slice(at,at+2),16)*(127/255)+[17,34,51][index]*(128/255)).toString(16).padStart(2,'0')).join('');return document.documentElement.style.getPropertyValue('--canvas')===expected;}),'RGBA contrast follows the revealed photograph');
        const dark = await tab.locator('html').evaluate(el=>({text:el.style.getPropertyValue('--text'),accent:el.style.getPropertyValue('--accent')}));
        check(bright.text!==dark.text && bright.accent!==dark.accent,'Background drives text and border colors');
        check(await tab.getByRole('button',{name:'게임 기본',exact:true}).count()===0,'No game color preset');
        await tab.screenshot({path:`output/playwright/${game}-${mobile?'mobile':'desktop'}-rgba-picker.png`});
        const hex=picker().getByRole('textbox',{name:'HEX',exact:true});await hex.fill('#bad');await hex.press('Tab');
        check(await stored()==='#11223380' && await hex.inputValue()==='#11223380','Invalid draft does not replace saved color');
        await hex.focus();await hex.press('Tab');check(await picker().getByRole('button',{name:'닫기',exact:true}).evaluate(el=>el===document.activeElement),'Tab remains inside picker');
        await tab.keyboard.press('Escape');check(await picker().count()===0 && await tab.locator('.theme-settings').isVisible(),'Escape closes only picker');
        check(await button('색상 선택').evaluate(el=>el===document.activeElement),'Focus returns to swatch');
        await button('닫기').click();await tab.reload();await tab.locator('.atmosphere.is-ready').waitFor();await openTheme();await openPicker();
        check(await picker().getByRole('textbox',{name:'HEX',exact:true}).inputValue()==='#11223380','RGBA survives reload');
        await choose('#ffffff00');check(await tab.evaluate(()=>document.documentElement.style.getPropertyValue('--canvas')===document.querySelector('.atmosphere').dataset.photoAverage),'Zero alpha exposes the photo color');

        await picker().getByRole('button',{name:'닫기',exact:true}).click();await button('크림슨').click();await openPicker();
        check(await tab.locator('.atmosphere').getAttribute('data-photo-alpha')==='0','Transparent Crimson reveals its photograph too');
        await choose('#ffffff80');await picker().getByRole('button',{name:'닫기',exact:true}).click();
        await button('기본 색상으로').click();await tab.waitForFunction(()=>localStorage.getItem('modfinder-background-color')===null);
        await button('자동 색상').click();await openPicker();
        check(await picker().getByRole('textbox',{name:'HEX',exact:true}).inputValue()===defaultColor,'Reset restores the selected game RGBA default');
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
