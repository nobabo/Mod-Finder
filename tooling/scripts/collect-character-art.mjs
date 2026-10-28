import { writeFile, mkdir, readFile, access } from 'node:fs/promises';

if (process.argv.includes('--official')) {
  const html = await (await fetch('https://www.cyberpunk.net/en/en/cyberpunk-2077')).text();
  console.log([...new Set(html.match(/\/build\/images\/cyberpunk\/character\/[^"'<>\s]+\.png/g))]);
  process.exit(0);
}

const sources = [
  ['skyrim-se', 'https://en.uesp.net/w/api.php', 'Skyrim:Iron|Skyrim:Food', /helmet|sweetroll/i],
  ['lethal-company', 'https://lethal.miraheze.org/w/api.php', 'Employee|Hoarding_Bug', /employee|hoard|bug/i],
  ['rimworld', 'https://rimworldwiki.com/api.php', 'Thrumbo|Muffalo', /thrumbo|muffalo/i],
  ['valheim', 'https://valheim.fandom.com/api.php', 'Greydwarf|Troll', /greydwarf|troll/i],
  ['terraria', 'https://terraria.wiki.gg/api.php', 'Guide|Blue_Slime', /guide|blue.slime/i],
  ['project-zomboid', 'https://pzwiki.net/w/api.php', 'Spiffo|Baseball_Bat', /spiffo|baseball/i],
  ['cyberpunk-2077', 'https://cyberpunk.fandom.com/api.php', 'Johnny_Silverhand|Relic_(item)', /johnny|silverhand|relic/i],
  ['baldurs-gate-3', 'https://bg3.wiki/w/api.php', 'Astarion|Shadowheart', /portrait.*(?:astarion|shadowheart)/i],
  ['fallout-4', 'https://fallout.wiki/api.php', 'Vault_Boy|Nuka-Cola_(Fallout_4)', /vault.*boy|nuka.*cola/i],
  ['risk-of-rain-2', 'https://riskofrain2.wiki.gg/api.php', 'Commando|Ukulele', /commando|ukulele/i],
  ['cities-skylines', 'https://skylines.paradoxwikis.com/api.php', 'Chirper|Power', /chirper|turbine/i],
  ['dont-starve-together', 'https://dontstarve.wiki.gg/api.php', 'Wilson|Chester', /wilson|chester/i],
];
const selected = [
  ['skyrim-se','iron-helmet',sources[0][1],'File:SR-icon-armor-IronHelmet.png'],
  ['skyrim-se','sweetroll',sources[0][1],'File:SR-icon-food-SweetRoll.png'],
  ['lethal-company','employee',sources[1][1],'File:Waving Employee.png'],
  ['lethal-company','hoarding-bug',sources[1][1],'File:Hoardingbugrender.png'],
  ['rimworld','thrumbo',sources[2][1],'File:Thrumbo.png'],
  ['rimworld','muffalo',sources[2][1],'File:Muffalo south.png'],
  ['valheim','troll',sources[3][1],'File:Troll.png'],
  ['valheim','greydwarf',sources[3][1],'File:Greydwarf.png'],
  ['terraria','guide',sources[4][1],'File:Guide.png'],
  ['terraria','blue-slime',sources[4][1],'File:Blue Slime.png'],
  ['project-zomboid','spiffo','https://projectzomboid.fandom.com/api.php','File:Spiffo of Apocalypse.png'],
  ['project-zomboid','baseball-bat','https://projectzomboid.fandom.com/api.php','File:Baseball bat inv.png'],
  ['cyberpunk-2077','johnny-silverhand','https://www.cyberpunk.net/build/images/cyberpunk/character/character-johnny@1x-3a4afbd5.png','https://www.cyberpunk.net/en/en/cyberpunk-2077'],
  ['cyberpunk-2077','jackie-welles','https://www.cyberpunk.net/build/images/cyberpunk/character/character-jackie@1x-907b804d.png','https://www.cyberpunk.net/en/en/cyberpunk-2077'],
  ['baldurs-gate-3','astarion',sources[7][1],'File:Astarion Model.png'],
  ['baldurs-gate-3','shadowheart',sources[7][1],'File:Shadowheart Model.png'],
  ['fallout-4','vault-boy',sources[8][1],'File:Vault Boy.png'],
  ['fallout-4','nuka-cola',sources[8][1],'File:Nukacolabottlefull2.png'],
  ['risk-of-rain-2','commando',sources[9][1],'File:Commando.png'],
  ['risk-of-rain-2','ukulele',sources[9][1],'File:Ukulele.png'],
  ['cities-skylines','wind-turbine',sources[10][1],'File:Wind Turbine.png'],
  ['cities-skylines','chirper',sources[10][1],'File:Chirper Surviving Mars.png'],
  ['dont-starve-together','wilson',sources[11][1],'File:Wilson Head.png'],
  ['dont-starve-together','chester',sources[11][1],'File:Chester.png'],
];
await mkdir('output/artwork', { recursive: true });
if (process.argv.includes('--download')) {
  const previous = JSON.parse(await readFile('output/artwork/downloads.json','utf8').catch(()=>'[]'));
  const records = [];
  for (let index=0;index<selected.length;index+=4) {
    const batch = await Promise.all(selected.slice(index,index+4).map(async ([game,name,endpoint,title]) => {
      const cached = previous.find(record=>record.game===game && record.name===name && record.title===title && !record.error);
      if (cached && await access(cached.local).then(()=>true,()=>false)) return cached;
      if (game==='cities-skylines') {
        const local = `output/artwork/${game}-${name}.png`;
        const bytes = await readFile(local).catch(()=>null);
        if (bytes?.toString('hex',0,8)==='89504e470d0a1a0a') return {game,name,local,title,sourceUrl:`https://skylines.paradoxwikis.com/File:${title.slice(5).replaceAll(' ','_')}`,imageUrl:`https://skylines.paradoxwikis.com/images/${name==='wind-turbine'?'3/3e/Wind_Turbine.png':'9/9a/Chirper_Surviving_Mars.png'}`,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bytes:bytes.length};
      }
      try {
        const query = new URL(endpoint);
        query.search = new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'url|size',titles:title});
        const direct = endpoint.startsWith('https://www.cyberpunk.net/build/');
        const response = direct ? null : await fetch(query,{headers:{'User-Agent':'ModFinderArtwork/1.0 (https://github.com/nobabo/Mod-Finder)'},signal:AbortSignal.timeout(30000)});
        const data = direct ? null : await response.json();
        const info = direct ? {url:endpoint,descriptionurl:title} : Object.values(data.query?.pages ?? {}).find(page => page.imageinfo)?.imageinfo[0];
        if (!info) throw Error('No image metadata');
        const original = info.url.replace(/\/revision\/latest.*$/,'');
        const file = await fetch(original,{headers:original.includes('wikia.nocookie.net') ? {'User-Agent':'Mozilla/5.0','Referer':info.descriptionurl} : {},signal:AbortSignal.timeout(18000)});
        if (!file.ok) throw Error(`Image HTTP ${file.status}`);
        const bytes = Buffer.from(await file.arrayBuffer());
        const extension = bytes.toString('hex',0,8) === '89504e470d0a1a0a' ? 'png' : bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP' ? 'webp' : undefined;
        if (!extension) throw Error(`Expected an image: ${file.headers.get('content-type')} from ${original}`);
        const local = `output/artwork/${game}-${name}.${extension}`;
        await writeFile(local,bytes);
        return {game,name,local,title,sourceUrl:info.descriptionurl,imageUrl:info.url,width:info.width ?? bytes.readUInt32BE(16),height:info.height ?? bytes.readUInt32BE(20),bytes:bytes.length};
      } catch(error) { return {game,name,error:error.message}; }
    }));
    records.push(...batch); for (const record of batch) console.log(JSON.stringify(record));
  }
  await writeFile('output/artwork/downloads.json',JSON.stringify(records,null,2)+'\n');
  process.exit(records.some(record=>record.error) ? 1 : 0);
}
const reports = [];
for (let index = 0; index < sources.length; index += 4) {
  const batch = await Promise.all(sources.slice(index,index+4).map(async ([game, endpoint, titles, match]) => {
    const url = new URL(endpoint);
    url.search = new URLSearchParams({action:'query',format:'json',prop:'images',imlimit:'max',titles});
    try {
      const response = await fetch(url, { headers: {'User-Agent':'ModFinderArtwork/1.0 (https://github.com/nobabo/Mod-Finder)'}, signal:AbortSignal.timeout(18000) });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const data = await response.json();
      const files = [...new Set(Object.values(data.query?.pages ?? {}).flatMap(page => page.images?.map(image => image.title) ?? []))].filter(title => match.test(title));
      return {game,endpoint,titles,files};
    } catch (error) { return {game,endpoint,error:error.message}; }
  }));
  reports.push(...batch);
  for (const report of batch) console.log(JSON.stringify(report));
}
await writeFile('output/artwork/discovery.json',JSON.stringify(reports,null,2)+'\n');
