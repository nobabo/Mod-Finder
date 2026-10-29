const nexusGames = new Set(['stardew-valley', 'skyrim-se', 'cyberpunk-2077', 'baldurs-gate-3', 'fallout-4', 'lethal-company', 'rimworld']);

/**
 * Narrow preparation-time repairs for newly translated Nexus summaries.
 * The original text and game must establish the intended meaning. This does
 * not change provider data, infer identities, or rewrite existing catalogs.
 */
export function applyNexusTranslationGlossary(gameId, original, korean) {
  if (!nexusGames.has(gameId) || typeof original !== 'string' || typeof korean !== 'string') return korean;
  let result = korean;

  if (gameId === 'stardew-valley') {
    // The observed footwear sentence mentions boot colors and their icons.
    // Do not change genuine computer booting terminology elsewhere.
    if (/\bboots?\s+colou?rs?\b/i.test(original) && /\b(?:icons?|footwear|shoes?)\b/i.test(original)) {
      result = result.replace(/부팅(?=\s*(?:색상|색깔|색))/g, '부츠');
    }
    if (/\bAnimal Husbandry(?:\s+mod)?\b/.test(original)) {
      result = result.replace(/애완\s*동물\s*결혼|동물\s*결혼/g, 'Animal Husbandry');
    }
    if (/\bheart\s+events?\b/i.test(original)) {
      result = result.replace(/심장\s*이벤트/g, '호감도 이벤트');
    }
    if (/\bStardew\s+Valley\b/i.test(original)) {
      result = result.replace(/Stardew\s*밸리|스타\s+듀\s*밸리|스타듀\s*계곡/g, '스타듀 밸리');
    }
  }

  // "Characters" can mean people or text. Require both a count-of-people
  // construction and explicit NPC/appearance context; preserve text limits.
  if (/\b(?:NPCs?|dialogues?|hairstyles?|portraits?|companions?|Fashion Sense)\b/i.test(original)
      && !/\b(?:password|input|text|letters?|typing|character\s+limit)\b/i.test(original)) {
    for (const match of original.matchAll(/\b(?:for|adds?|includes?|supports?)\s+(\d{1,3})\s+(?:new\s+)?characters\b/gi)) {
      const count = match[1];
      result = result.replace(new RegExp(`(^|[^\\d])${count}\\s*자(?=\\s|[(),.!?]|$)`, 'g'), `$1${count}명`);
    }
  }

  // Repair only the isolated, truncated phrase observed in model output.
  // A correctly negated sentence or an unrelated update remains untouched.
  if (/\bno longer updating\b/i.test(original)) {
    result = result.replace(/더\s*이상\s*업데이트(?=\s*(?:[*.!\]\)]|$))/g, '더 이상 업데이트하지 않습니다');
  }
  if (/\bbug fixes\b/i.test(original)) result = result.replace(/벌레\s*수정/g, '버그 수정');
  if (/\bcharacter\s+creation\b/i.test(original) && !/\b(?:unicode|encoding|font|ASCII)\b/i.test(original)) {
    result = result.replace(/문자\s*생성/g, '캐릭터 생성');
  }
  if (gameId === 'cyberpunk-2077' && /\bperk\s+trees?\b/i.test(original)) result = result.replace(/특전\s*나무/g, '특전 트리');
  if (gameId === 'cyberpunk-2077' && /\bNCART\s+stations?\b/i.test(original)) result = result.replace(/NCART\s*방송국/g, 'NCART 역');
  if (gameId === 'fallout-4' && /\b(?:weapon|rifle|pistol|gun)\s+receivers?\b/i.test(original)
      && !/\b(?:radio|signal|wireless)\b/i.test(original)) {
    result = result.replace(/수신기/g, '리시버');
  }
  if (gameId === 'baldurs-gate-3' && !/\b(?:pain|body|breast|torso)\b/i.test(original)) {
    // Both nouns end in a consonant, preserving the model's existing particles.
    if (/\bcamp\s+chests?\b/i.test(original)) result = result.replace(/캠프\s*가슴/g, '야영지 보관함');
    if (/\btutorial\s+chests?\b/i.test(original)) result = result.replace(/튜토리얼\s*가슴/g, '튜토리얼 보관함');
  }

  if (gameId === 'skyrim-se' && /\bSkyrim\b/i.test(original)) result = result.replace(/스카이\s+림/g, '스카이림');
  if (gameId === 'cyberpunk-2077' && /\bCyberpunk\s*2077\b/i.test(original)) result = result.replace(/사이버\s+펑크\s*2077/g, '사이버펑크 2077');
  if (gameId === 'baldurs-gate-3' && /\bBaldur['’]?s\s+Gate\s+3\b/i.test(original)) result = result.replace(/발(?:더스|두르스|두르의)\s*(?:의\s*)?문\s*3/g, '발더스 게이트 3');
  if (gameId === 'fallout-4' && /\bFallout\s+4\b/i.test(original)) result = result.replace(/낙진\s*4/g, '폴아웃 4');
  return result;
}
