const steamGames = new Set(['rimworld', 'terraria', 'project-zomboid', 'cities-skylines', 'dont-starve-together']);

// Apply only to new, source-matched translations. English mod names, URLs and
// inline code remain untouched; every correction requires supporting source text.
export function applySteamTranslationGlossary(gameId, original, korean) {
  if (!steamGames.has(gameId) || typeof original !== 'string' || typeof korean !== 'string') return korean;
  const transform = text => {
    let result = text;
    if (/\bplayers?\b/i.test(original) && !/\b(?:soccer|football|basketball|athlete|workplace)\b/i.test(original)) {
      result = result.replace(/선수(?=들|[은는이가을를의와과,.;:!?\s]|$)/g, '플레이어');
    }
    if (/\bSteam\s+Workshop\b/i.test(original)) {
      result = result.replace(/(?:스팀|증기|Steam)\s*작업장/g, 'Steam 창작마당');
    }
    if (gameId === 'rimworld') {
      if (/\bcolonists?\b/i.test(original)) result = result.replace(/식민지\s*주민/g, '정착민');
      if (/\bcolon(?:y|ies)\b/i.test(original)) result = result.replace(/식민지/g, '정착지');
      if (/\bresearch\s+tree\b/i.test(original)) result = result.replace(/연구\s+나무/g, '연구 트리');
      if (/\bpawns?\b/i.test(original) && !/\b(?:chess|pawnshop|pawn\s+shop|board\s+game)\b/i.test(original)) {
        result = result.replace(/졸(은|이|을|과|의)?(?=[,.;:!?\s]|$)/g, (_, particle = '') => `캐릭터${({ 은: '는', 이: '가', 을: '를', 과: '와', 의: '의' })[particle] ?? ''}`);
      }
      if (/\bthe\s+Numbers\s+panel\b/.test(original)) result = result.replace(/숫자\s+패널/g, 'Numbers 패널');
      if (/\bcategories\b/i.test(original) && /\bprops?\b/i.test(original) && /\bnew\s+cat$/i.test(original.trim())) {
        result = result.replace(/새\s+고양이에\s+소품/g, '새 카테고리에 소품');
      }
      if (/\bbloodborne[\s-]+inspired\b/i.test(original)) result = result.replace(/혈통에서\s+영감을/g, 'Bloodborne에서 영감을');
    }
    if (gameId === 'terraria') {
      if (/\bTerraria\b/i.test(original)) result = result.replace(/테라\s+리아/g, '테라리아');
      if (/\bboss(?:es)?\b/i.test(original) && !/\b(?:my\s+boss|our\s+boss|employer|workplace)\b/i.test(original)) {
        result = result.replace(/상사(?=들|[은는이가을를의와과,.;:!?\s]|$)/g, '보스');
      }
      if (/\bcritical(?:ly)?\s+(?:hit|hits|damage)\b/i.test(original)) result = result.replace(/비판적으로/g, '치명타로');
      if (/\bsprites\s*\/\s*textures\b/i.test(original)) result = result.replace(/스프레이\s*\/\s*텍스처/g, '스프라이트/텍스처');
    }
    if (gameId === 'project-zomboid') {
      if (/\bProject\s+Zomboid\b/i.test(original)) result = result.replace(/프로젝트\s+좀비(?=[은는이가을를의와과,.;:!?\s]|$)/g, '프로젝트 좀보이드');
      for (const version of original.matchAll(/\bBuild\s*(\d{2,3}(?:\.\d+)*)\b/gi)) {
        const escaped = version[1].replace(/\./g, '\\.');
        result = result.replace(new RegExp(`(?:건설|구축)\\s*(${escaped})(?!(?:\\d|\\.\\d))`, 'g'), '빌드 $1');
      }
      if (/\bforag(?:ing|eable)\b/i.test(original)) result = result.replace(/먹이\s*찾기/g, '채집');
      if (/\bforageable\s+items\b/i.test(original)) result = result.replace(/먹이\s*항목/g, '채집 아이템');
      if (/\bweather\s+penalt(?:y|ies)\b/i.test(original)) result = result.replace(/날씨\s*처벌/g, '날씨 불이익');
      if (/\bspotting\s+distance\b/i.test(original)) result = result.replace(/스팟\s*거리/g, '발견 거리');
      if (/\bcraft(?:-|\s*)able\b/i.test(original)) result = result.replace(/공예\s*가능/g, '제작 가능');
      if (/\bcrafting\s+materials\b/i.test(original)) result = result.replace(/공예\s*재료/g, '제작 재료');
    }
    if (gameId === 'cities-skylines') {
      if (/\bCities:\s*Skylines\b/i.test(original)) result = result.replace(/도시:\s*스카이\s*라인/g, '시티즈: 스카이라인');
      if (/\blow\s+density\s+commercial\b/i.test(original)) result = result.replace(/저밀도\s*광고/g, '저밀도 상업');
      if (/\bhigh\s+density\s+commercial\b/i.test(original)) result = result.replace(/고밀도\s*광고/g, '고밀도 상업');
      if (/\b(?:growable|growble)\b/i.test(original)) result = result.replace(/그로블|그로어블/g, '자동 생성형');
      if (/\bmods?\s+from\s+bloody\s+penguin\b/i.test(original)) result = result.replace(/피\s*묻은\s*펭귄/g, 'bloody penguin');
    }
    if (gameId === 'dont-starve-together') {
      if (/\bDon't\s+Starve\s+Together\b/i.test(original)) result = result.replace(/함께\s*굶지\s*(?:마세요|마십시오|마)(?=[은는이가을를의와과,.;:!?\s]|$)/g, '돈 스타브 투게더');
      if (/\bClean\s+Sweeper\b/.test(original)) result = result.replace(/청소\s*스위퍼/g, 'Clean Sweeper');
      if (/\brequires\s+trailblazer\s+for\s+pathfinding\b/i.test(original)) result = result.replace(/길\s*찾기를\s*위한\s*선구자/g, '길 찾기용 trailblazer');
      if (/\bcreated\s+by\s+Mortis\s+Ghost\b/i.test(original)) result = result.replace(/mortis\s*유령/gi, 'Mortis Ghost');
      if (/\bsanity\s+aura\b/i.test(original)) result = result.replace(/정신\s*기운/g, '정신력 오라');
      const stats = original.match(/\bHealth\s+(\d+)\s*,\s*San\s+(\d+)\s*,\s*Hungry\s+(\d+)/i);
      if (stats) result = result.replace(new RegExp(`건강\\s*${stats[1]},\\s*산\\s*${stats[2]},\\s*배고픈\\s*${stats[3]}(?!\\d)`, 'g'), `체력 ${stats[1]}, 정신력 ${stats[2]}, 허기 ${stats[3]}`);
    }
    return result;
  };
  return korean.split(/(https?:\/\/[^\s<>]+|`[^`]*`)/g).map((part, index) => index % 2 ? part : transform(part)).join('');
}
