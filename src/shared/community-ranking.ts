export interface CommunityPost { id: string; title: string }
// Deliberate aliases for individual packs. Ambiguous standalone mod names (e.g.
// Create, GregTech, Cobblemon, Aeronautics) are not counted as modpacks.
export const COMMUNITY_PACKS = [
  { id: 'sunlit-valley', name: 'Sunlit Valley', pattern: '선릿|sunlit\\s*valley' },
  { id: 'gtnh', name: 'GT New Horizons', pattern: 'gtnh|gt\\s*new\\s*horizons|그뉴호|뉴호' },
  { id: 'cobbleverse', name: 'COBBLEVERSE', pattern: '코블버스|cobbleverse' },
  { id: 'star-technology', name: 'Star Technology', pattern: '\\bstarT\\b|star\\s*tech(?:nology)?|스타텍|스타테크' },
  { id: 'deceasedcraft', name: 'DeceasedCraft', pattern: '디시즈|deceased\\s*craft' },
  { id: 'monifactory', name: 'Monifactory', pattern: '모니(?!터)|monifactory' },
  { id: 'atm10', name: 'All the Mods 10', pattern: 'a[._ ]?t[._ ]?m[ _.-]*10(?!\\d)|all\\s*the\\s*mods\\s*10(?!\\d)' },
  { id: 'prominence2', name: 'Prominence II RPG', pattern: '프로미넌스|포로미넌스|prominence' },
  { id: 'terrafirma-engineering', name: 'TerraFirma Engineering', pattern: '테라퍼[마메]\\s*엔지니어링|terrafirma\\s*engineering' },
  { id: 'craft-to-exile2', name: 'Craft to Exile 2', pattern: '\\bcte\\s*2\\b|craft\\s*to\\s*exile\\s*2|크래프트\\s*투\\s*엑자일\\s*2' },
  { id: 'zero-to-engineering', name: 'Zero to Engineering', pattern: '제로\\s*투\\s*엔지니어링|zero\\s*to\\s*engineering' },
  { id: 'gregtech-odyssey', name: 'GregTech Odyssey', pattern: '\\bgto\\b|그렉텍\\s*오디세이|gregtech\\s*odyssey' },
  { id: 'nightfall', name: 'Nightfall Craft', pattern: '나이트폴|nightfall' },
  { id: 'atm11', name: 'All the Mods 11', pattern: '\\batm[ _.-]*11(?!\\d)|all\\s*the\\s*mods\\s*11(?!\\d)' },
  { id: 'atm9-tts', name: 'All the Mods 9 - To the Sky', pattern: '\\batm[ _.-]*9\\s*(?:tts|to the sky)|all\\s*the\\s*mods\\s*9\\s*-?\\s*to\\s*the\\s*sky' },
  { id: 'atm9', name: 'All the Mods 9', pattern: '\\batm[ _.-]*9(?!\\d|\\s*(?:tts|to the sky))|all\\s*the\\s*mods\\s*9(?!\\d|\\s*-?\\s*to\\s*the\\s*sky)' },
  { id: 'ftb-skies2', name: 'FTB Skies 2', pattern: 'ftb\\s*skies\\s*2|스카이즈\\s*2' },
  { id: 'cabin', name: 'Create: Above and Beyond In Newer', pattern: '\\bcabin\\b' },
  { id: 'homestead', name: 'Homestead', pattern: '\\bhomestead\\b|홈스테드' },
  { id: 'meatballcraft', name: 'MeatballCraft', pattern: 'meatballcraft|미트볼크래프트' },
];

export function countCommunityMentions(posts: CommunityPost[]) {
  const unique = [...new Map(posts.map(post => [post.id, post])).values()];
  return COMMUNITY_PACKS.map(pack => {
    const pattern = new RegExp(pack.pattern, 'i');
    const matched = unique.filter(post => pattern.test(post.title.normalize('NFKC')));
    return { id: pack.id, name: pack.name, mentions: matched.length, postIds: matched.map(post => post.id) };
  }).filter(item => item.mentions > 0).sort((a, b) => b.mentions - a.mentions || a.id.localeCompare(b.id));
}
