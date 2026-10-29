/** Preparation-only repairs. Original wording must establish the game meaning. */
export function applyMinecraftTranslationGlossary(gameId, original, korean) {
  if (gameId !== 'minecraft-java') return korean;
  let result = korean;
  if (/\bmodpacks?\b/i.test(original)) result = result.replace(/\bmodpacks?\b/gi, '모드팩').replace(/모드\s+팩/g, '모드팩');
  if (/\bmods?\b/i.test(original) && !/All the Mods/.test(original)) result = result.replace(/\bmods?\b/gi, '모드');
  if (/\bMinecraft(?:\s+Java\s+Edition)?\b/i.test(original)) result = result.replace(/\bMinecraft Java Edition\b/g, '마인크래프트 자바 에디션').replace(/\bMinecraft\b/g, '마인크래프트');
  if (/\bFabric\b/.test(original)) result = result.replace(/직물(?=[은는이가을를의에과와도,.)\s]|$)/g, '패브릭');
  if (/\b(?:forge|Forge)\s+mod\b/.test(original)) result = result.replace(/단조\s*모드|대장간\s*모드/g, '포지 모드');
  if (/\bforge\s+(?:some\s+)?alloys?\b/i.test(original)) result = result.replace(/위조/g, '제련');
  if (/\bmobs?\b/i.test(original)) result = result.replace(/폭도/g, '몹');
  if (/\billagers?\b/i.test(original)) result = result.replace(/병약자/g, '우민');
  if (/\bvillagers?\b/i.test(original)) result = result.replace(/\bvillagers?\b/gi, '주민');
  if (/\b(?:quality[- ]of[- ]life|QoL)\b/i.test(original)) result = result.replace(/삶의\s*질/g, '편의 기능');
  if (/\bshaders?\b/i.test(original)) result = result.replace(/쉐이더/g, '셰이더');
  if (/\bresource\s+packs?\b/i.test(original)) result = result.replace(/자원\s*팩/g, '리소스팩');
  if (/\bSodium\b/i.test(original) && /\b(?:FPS|performance|optimization|renderer|rendering|Iris)\b/i.test(original)) result = result.replace(/나트륨/g, '소듐');
  if (/\bIris\b/.test(original) && /\b(?:shaders?|Sodium|renderer)\b/i.test(original)) result = result.replace(/홍채/g, '아이리스');
  if (/\bclient[- ]side\b/i.test(original)) result = result.replace(/고객\s*측/g, '클라이언트 측');
  if (/\blibrary\b/i.test(original) && /\b(?:code|API|developers?|other mods|dependency|dependencies)\b/i.test(original)) result = result.replace(/도서관/g, '라이브러리');
  return result;
}
