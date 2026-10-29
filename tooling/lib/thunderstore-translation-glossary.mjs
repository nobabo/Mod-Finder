const supportedGames = new Set(['lethal-company', 'valheim', 'risk-of-rain-2']);

// Display-text corrections for newly translated Thunderstore descriptions only.
// Every replacement requires the corresponding English meaning in the source;
// this function never changes source text, titles, IDs, or provider data.
export function applyThunderstoreTranslationGlossary(gameId, original, korean) {
  if (typeof original !== 'string' || typeof korean !== 'string') throw new TypeError('Translation text must be a string');
  if (!supportedGames.has(gameId)) return korean;
  let result = korean;
  if (gameId === 'lethal-company') {
    if (/\bLethal\s+Com(?:pany|apny)\b/i.test(original)) {
      result = result.replace(/치명적(?:인)?\s*회사|레탈\s*컴퍼니/g, '리썰 컴퍼니');
    }
    const suitNoun = /\b(?:player|custom|new|more|additional|models?|costumes?|cosmetics?)\b[^.!?]{0,100}\bsuits?\b|\bas\s+(?:a\s+)?suits?\b|\badd(?:s|ing)?\b[^.!?]{0,100}\bsuits?\b|\bsuits?\s+(?:are|have|with|for|pack|bundle)\b/i;
    if (suitNoun.test(original) && !/\blaw\s*suits?\b|\blegal\b|\bcourt\b|\bsu(?:e|es|ing)\b/i.test(original)) {
      const suitForms = { '소송으로': '슈트로', '소송을': '슈트를', '소송은': '슈트는', '소송이': '슈트가', '소송과': '슈트와' };
      result = result.replace(/소송으로|소송을|소송은|소송이|소송과|소송(?=[\s.,!?;:()]|$)/g, value => suitForms[value] ?? '슈트');
      const clothingForms = { '양복으로': '슈트로', '양복을': '슈트를', '양복은': '슈트는', '양복이': '슈트가', '양복과': '슈트와' };
      result = result.replace(/양복으로|양복을|양복은|양복이|양복과|양복(?=[\s.,!?;:()]|$)/g, value => clothingForms[value] ?? '슈트');
    }
    if (/\bshoot(?:s|ing)?\b/i.test(original) && /\b(?:guns?|shotguns?|firearms?|bullets?)\b|\bafter\s+shooting\b|\bshoot(?:ing)?\s+(?:yourself|enemies|targets?)\b/i.test(original) &&
        !/\b(?:photo(?:graphy)?|cameras?|films?|movies?|videos?|screenshots?)\b|\bshooting\s+stars?\b/i.test(original)) {
      result = result.replace(/촬영/g, '사격');
    }
    if (/\bmid[-\s]?game\s+moons?\b/i.test(original)) result = result.replace(/미드\s*게임\s*문/g, '중반용 위성');
    if (/\bearly[-\s]?game\s+moons?\b/i.test(original)) result = result.replace(/초기\s*게임\s*문/g, '초반용 위성');
    if (/\blate[-\s]?game\s+moons?\b/i.test(original)) result = result.replace(/후기\s*게임\s*문/g, '후반용 위성');
  }
  if (gameId === 'valheim' && /\bValheim\b/.test(original)) result = result.replace(/발하임/g, '발헤임');
  if (gameId === 'valheim' && /\bchests?\b/i.test(original) &&
      /\b(?:storage|items?|craft|crafting|build|bases?|deposit|resources?|network|inventory|loot|stacks?)\b/i.test(original) &&
      !/\bchest\s+(?:armou?r|pieces?|plates?)\b|\b(?:breast|torso|body)\b/i.test(original)) {
    const forms = { '가슴으로': '상자로', '가슴을': '상자를', '가슴은': '상자는', '가슴이': '상자가', '가슴과': '상자와' };
    result = result.replace(/가슴으로|가슴을|가슴은|가슴이|가슴과|가슴/g, value => forms[value] ?? '상자');
  }
  if (gameId === 'valheim' && /["']Constitution["']\s+skill/.test(original) && /\b(?:health|stamina)\b/i.test(original)) {
    result = result.replace(/헌법/g, '체질');
    if (!result.includes('Constitution')) result = result.replace('체질', '체질(Constitution)');
  }
  if (/\bcraft(?:s|ing)?\b/i.test(original) && !/\barts?\s+and\s+crafts?\b/i.test(original)) {
    const particles = { '와': '과', '가': '이', '는': '은', '를': '을', '로': '으로' };
    result = result.replace(/공예(와|가|는|를|로)?/g, (_value, particle) => `제작${particles[particle] ?? ''}`);
  }
  if (gameId === 'risk-of-rain-2' && /\bRisk\s+of\s+Rain\s+2\b/i.test(original)) result = result.replace(/비의\s*위험\s*2|비가\s*올\s*위험\s*2|Rain\s*2의\s*위험/g, '리스크 오브 레인 2');
  if (gameId === 'risk-of-rain-2' && /\bRisk\s+of\s+Rain\b/i.test(original)) result = result.replace(/비의\s*위험/g, '리스크 오브 레인');
  if (gameId === 'risk-of-rain-2' && /\b(?:skins?\s+(?:for|that)|(?:custom|edited|alternate|new)\s+skins?)\b/i.test(original) &&
      !/\b(?:cancer|disease|rashes?|dermatitis|wounds?|injuries|care)\b/i.test(original)) {
    const forms = { '피부를': '스킨을', '피부가': '스킨이', '피부는': '스킨은', '피부와': '스킨과', '피부로': '스킨으로' };
    result = result.replace(/피부를|피부가|피부는|피부와|피부로|피부/g, value => forms[value] ?? '스킨');
  }
  if (/\bDiscord\s+(?:servers?|community|channels?)\b|\b(?:join|our|my)\s+Discord\b|\bdiscord\.gg\//i.test(original) || /\b[A-Z0-9_]{2,}\s+discord\b/.test(original)) {
    result = result.replace(/불화/g, '디스코드');
  }
  if (/\bspawn(?:ing)?\s+(?:rates?|chances?|frequenc(?:y|ies))\b/i.test(original)) {
    const particles = { '와': '과', '가': '이', '는': '은', '를': '을', '로': '로' };
    result = result.replace(/산란\s*(?:속도|비율|확률|빈도|율)(와|가|는|를|로)?/g, (_value, particle) => `생성률${particles[particle] ?? ''}`);
  }
  if (/\bRussian\s+roulette\b/i.test(original)) result = result.replace(/러시아어\s*룰렛|러시아\s*룰렛/g, '러시안 룰렛');
  if (/\bQOL\b|\bquality[-\s]+of[-\s]+life\s+(?:mods?|packs?|features?|improvements?|changes?|tweaks?)\b/i.test(original) ||
      (/\bmodpacks?\b/i.test(original) && /\bquality[-\s]+of[-\s]+life\b/i.test(original))) {
    result = result.replace(/삶의\s*질/g, '편의성').replace(/삶의\s*기능/g, '편의 기능').replace(/\bQOL\b|\bquality[-\s]+of[-\s]+life\b/gi, '편의 기능');
  }
  if (/\bcosmetic(?:s|\s+(?:mods?|sets?|items?|changes?))\b|\bpurely\s+cosmetic\b/i.test(original) &&
      !/\b(?:makeup|beauty|lipsticks?|products?)\b|\bskin\s+care\b/i.test(original)) {
    const forms = { '화장품으로': '외형 꾸미기로', '화장품을': '외형 꾸미기를', '화장품은': '외형 꾸미기는', '화장품이': '외형 꾸미기가', '화장품과': '외형 꾸미기와' };
    result = result.replace(/화장품으로|화장품을|화장품은|화장품이|화장품과|화장품/g, value => forms[value] ?? '외형 꾸미기');
  }
  if (/\bemotes?\b/i.test(original) && !/\bchat\s+emotes?\b/i.test(original)) result = result.replace(/이모티콘/g, '감정 표현');
  if (/\bstutters?\b/i.test(original) && /\b(?:FPS|performance|lag)\b|\bframe\s*(?:rate|time)\b/i.test(original)) {
    result = result.replace(/말더듬/g, '끊김');
  }
  if (/\b(?:break(?:ing)?|preserv(?:e|ing)|maintain(?:ing)?)\s+(?:the\s+)?immersion\b/i.test(original)) {
    const forms = { '침수를': '몰입을', '침수가': '몰입이', '침수는': '몰입은', '침수와': '몰입과', '침수로': '몰입으로' };
    result = result.replace(/침수를|침수가|침수는|침수와|침수로|침수/g, value => forms[value] ?? '몰입');
  }
  if (/\boverhaul\s+(?:mods?|modpacks?|systems?|adding)\b/i.test(original)) {
    const particles = { '와': '과', '가': '이', '는': '은', '를': '을', '로': '으로' };
    result = result.replace(/정밀\s*검사(와|가|는|를|로)?/g, (_value, particle) => `전면 개편${particles[particle] ?? ''}`);
  }
  if (/\bmodpacks?\b/i.test(original)) result = result.replace(/\bmodpack(s)?\b/gi, (_value, plural) => `모드팩${plural ? '들' : ''}`);
  if (/\b(?:all\s+)?credits?\s+(?:to|go(?:es)?\s+to)\b/i.test(original) && !/\b(?:bank|money|currency|balance)\b/i.test(original)) {
    const particles = { '신용은': '공로는', '신용이': '공로가', '신용을': '공로를', '신용과': '공로와', '신용으로': '공로로' };
    result = result.replace(/신용으로|신용은|신용이|신용을|신용과|신용/g, value => particles[value] ?? '공로');
  }
  // Explicit, observed proper-name translations; do not infer arbitrary names.
  for (const [name, translated] of [
    ['HealthMetrics', /체력\s*지표/g],
    ['SoundAPI', /사운드\s*API/g],
    ['BetterMenuSong', /더\s*나은\s*메뉴\s*노래/g],
    ['Amazing Nature', /놀라운\s*자연/g],
  ]) {
    if (new RegExp(`\\b${name}\\b`).test(original) && !result.includes(name)) result = result.replace(translated, name);
  }
  return result;
}
