import json
from pathlib import Path
from PIL import Image, ImageDraw

records = json.loads(Path('output/artwork/downloads.json').read_text())
sheet = Image.new('RGB', (1440, 1080), '#3c4146')
draw = ImageDraw.Draw(sheet)
for index, record in enumerate(records):
    if record.get('error'):
        continue
    image = Image.open(record['local']).convert('RGBA')
    if record['name'] == 'hoarding-bug':
        bounds = image.crop((0,0,image.width,1000)).getbbox()
    else:
        bounds = image.getbbox()
    record['actualWidth'], record['actualHeight'] = image.size
    record['crop'] = list(bounds)
    record['transparent'] = image.getchannel('A').getextrema()[0] == 0
    preview = image.crop(bounds)
    preview.thumbnail((220, 220), Image.Resampling.LANCZOS)
    x, y = index % 6 * 240, index // 6 * 270
    draw.text((x+4,y+4), record['game'], fill='white')
    draw.text((x+4,y+18), record['name'], fill='white')
    sheet.paste(preview, (x+(240-preview.width)//2,y+44), preview)
Path('output/artwork/inspection.json').write_text(json.dumps(records,indent=2)+'\n')
sheet.save('output/artwork/contact-reviewed.png')
print(json.dumps([dict(name=r['name'],transparent=r.get('transparent'),crop=r.get('crop')) for r in records]))
