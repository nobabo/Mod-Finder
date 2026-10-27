// Playwright CLI: --filename tooling/scripts/verify-photo-transparency.js
async (page) => {
  const base = new URL(page.url()).origin;
  const check = (value,message) => { if(!value) throw Error(message); };
  const reports=[];
  for(const mobile of [false,true]) {
    const context=await page.context().browser().newContext({viewport:{width:mobile?390:1536,height:mobile?844:960},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
    try {
      await context.addInitScript(()=>{localStorage.setItem('modfinder-intro-seen','1');document.cookie='mf-language=ko; Path=/';});
      const tab=await context.newPage(),errors=[];
      tab.on('pageerror',error=>errors.push(error.message));
      const button=name=>tab.getByRole('button',{name,exact:true});
      const picker=()=>tab.getByRole('dialog',{name:'배경색',exact:true});
      const choose=async hex=>{
        await picker().getByRole('textbox',{name:'HEX',exact:true}).fill(hex);
        await tab.waitForFunction(value=>localStorage.getItem('modfinder-background-color')===value,hex);
        await tab.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      };
      const stats=()=>tab.locator('.search-box>.glass-control-surface').evaluate(canvas=>{
        const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        let sum=0,squares=0,count=0,hash=1;
        for(let y=Math.floor(canvas.height*.25);y<canvas.height*.75;y+=3) for(let x=Math.floor(canvas.width*.15);x<canvas.width*.85;x+=5) {
          const i=(y*canvas.width+x)*4,value=(pixels[i]+pixels[i+1]+pixels[i+2])/3;
          sum+=value;squares+=value*value;count++;hash=Math.imul(hash,31)+pixels[i]|0;
        }
        const mean=sum/count;
        return {mean,variation:Math.sqrt(squares/count-mean*mean),hash};
      });
      for(const game of ['minecraft-java','stardew-valley']) {
        await tab.goto(`${base}/?game=${game}`);await tab.locator('.atmosphere.is-ready').waitFor();
        await button('설정 메뉴').click();await button('테마').click();await button('색상 선택').click();
        await choose('#000000');const opaque=await stats();
        await choose('#00000080');const half=await stats();
        await choose('#00000000');const clear=await stats();
        check(clear.mean>half.mean+8 && half.mean>opaque.mean+8,'Lower alpha reveals progressively more photograph');
        check(clear.variation>opaque.variation+3,'Transparency reveals photographic detail');
        await choose('#ff000000');const red=await stats();
        await choose('#0000ff00');const blue=await stats();
        check(red.hash===blue.hash,'Zero-alpha colors leave the same uncolored photograph');
        await picker().getByRole('button',{name:'닫기',exact:true}).click();await button('닫기').click();
        await tab.screenshot({path:`output/playwright/${game}-${mobile?'mobile':'desktop'}-transparent-photo.png`});
        reports.push({game,mobile,opaque:Math.round(opaque.mean),half:Math.round(half.mean),transparent:Math.round(clear.mean),photoDetail:true});
      }
      for(const route of ['','?q=sodium','?page=favorites','?page=recent']) {
        await tab.goto(base+'/'+route);await tab.locator('.app-brand-header .brand-logo').waitFor();
        const logo=tab.locator('.app-brand-header .brand-logo');
        const checkLogo=()=>logo.evaluate(el=>{const box=el.getBoundingClientRect(),style=getComputedStyle(el);return box.top<=20 && Math.abs(box.left+box.width/2-innerWidth/2)<2 && style.animationName==='none' && !el.closest('.artwork-reaction');});
        check(await checkLogo(),'MF logo stays at the top center on every page');
        await logo.hover();await button('메인 화면으로 이동').click();check(await checkLogo(),'MF logo never bounces');
      }
      check(errors.length===0,errors.join('\n'));
    } finally {await context.close();}
  }
  return {passed:true,reports,staticHeaderAcrossPages:true};
}
