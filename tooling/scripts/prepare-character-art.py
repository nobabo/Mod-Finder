"""Bundle verified original images, recording alpha bounds for CSS clipping only."""
import json
import shutil
from pathlib import Path
from PIL import Image

labels = {
    'iron-helmet': ('철 투구','Iron Helmet','item'), 'sweetroll': ('스위트롤','Sweetroll','item'),
    'employee': ('직원','Employee','character'), 'hoarding-bug': ('비축벌레','Hoarding Bug','mob'),
    'thrumbo': ('트럼보','Thrumbo','mob'), 'muffalo': ('머팔로','Muffalo','mob'),
    'troll': ('트롤','Troll','mob'), 'greydwarf': ('회색난쟁이','Greydwarf','mob'),
    'guide': ('가이드','Guide','character'), 'blue-slime': ('파란 슬라임','Blue Slime','mob'),
    'spiffo': ('스피포','Spiffo','character'), 'baseball-bat': ('야구방망이','Baseball Bat','item'),
    'johnny-silverhand': ('조니 실버핸드','Johnny Silverhand','character'), 'jackie-welles': ('재키 웰즈','Jackie Welles','character'),
    'astarion': ('아스타리온','Astarion','character'), 'shadowheart': ('섀도하트','Shadowheart','character'),
    'vault-boy': ('볼트 보이','Vault Boy','character'), 'nuka-cola': ('누카콜라','Nuka-Cola','item'),
    'commando': ('코만도','Commando','character'), 'ukulele': ('우쿨렐레','Ukulele','item'),
    'wind-turbine': ('풍력 발전기','Wind Turbine','item'), 'chirper': ('처퍼','Chirper','character'),
    'wilson': ('윌슨','Wilson','character'), 'chester': ('체스터','Chester','mob'),
}
catalog = {}
sources = []
for record in json.loads(Path('output/artwork/downloads.json').read_text()):
    assert not record.get('error'), record
    image = Image.open(record['local']).convert('RGBA')
    assert image.getchannel('A').getextrema()[0] == 0, record['name']
    bounds = image.crop((0,0,image.width,1000)).getbbox() if record['name'] == 'hoarding-bug' else image.getbbox()
    left, top, right, bottom = bounds
    game, name = record['game'], record['name']
    ko, en, kind = labels[name]
    path = Path(record['local'])
    destination = Path('src/web/public/theme-art') / path.name
    shutil.copyfile(path,destination)
    entry = dict(name=name,src='/theme-art/'+path.name,width=right-left,height=bottom-top,imageWidth=image.width,imageHeight=image.height,crop=[left,top,right,bottom],ko=ko,en=en,kind=kind,displayWidth=110 if not catalog.get(game) else 78)
    if game == 'terraria': entry['pixelated'] = True
    catalog.setdefault(game,[]).append(entry)
    sources.append(dict(game=game,name=name,local=str(destination).replace('\\','/'),sourceUrl=record['sourceUrl'],imageUrl=record['imageUrl'],crop=entry['crop']))
for game, entries in {
    'minecraft-java': [('steve',526,694,128,'스티브','Steve','character'),('diamond',12,13,42,'다이아몬드','Diamond','item')],
    'stardew-valley': [('junimo',42,45,72,'주니모','Junimo','character'),('chicken',192,192,72,'닭','Chicken','mob')],
}.items():
    prefix = 'minecraft' if game == 'minecraft-java' else 'stardew'
    catalog[game] = [dict(name=name,src=f'/theme-art/{prefix}-{name}.webp',width=width,height=height,imageWidth=width,imageHeight=height,crop=[0,0,width,height],ko=ko,en=en,kind=kind,displayWidth=display,pixelated=name!='steve') for name,width,height,display,ko,en,kind in entries]
assert len(catalog) == 14 and all(len(entries)==2 for entries in catalog.values())
Path('src/shared/data/game-character-art.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
Path('docs/game-art-sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Bundled 24 original images; 28 character/mob/item entries, two per game. No pixels changed; CSS uses recorded alpha bounds.')
