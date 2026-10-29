// Repair a term only when the original title supplies the corresponding context.
// This changes presentation text; it never changes provider identifiers or names.
export function repairTitleTerms(original, korean, gameId) {
  let title = korean;
  const rules = [
    [/\bLibrary\b/i, /도서관/g, '라이브러리'],
    [/\bInventory\b/i, /재고/g, '인벤토리'],
    [/\bOverhaul\b/i, /정밀\s*검사/g, '전면 개편'],
    [/\bRace\b|\bSubrace\b/i, /경주/g, '종족'],
    [/\bSpells?\b/i, /철자법|철자/g, '주문'],
    [/\bPresets?\b/i, /사전\s*설정/g, '프리셋'],
    [/\bHotbar\b/i, /핫바/g, '단축바'],
    [/\bShader/i, /쉐이더/g, '셰이더'],
    [/\bModpack\b|\bMod Pack\b/i, /모드\s*팩/g, '모드팩'],
    [/\bFramework\b/i, /프레임\s*워크/g, '프레임워크'],
  ];
  if (gameId === 'minecraft-java') rules.push(
    [/\bFabric\b/, /직물|섬유/g, '패브릭'],
    [/\bNeoForge\b/i, /네오\s*포지/g, '네오포지'],
    [/\bForge\b/, /대장간/g, '포지'],
    [/\bQuilt\b/, /이불/g, '퀼트'],
    [/\bSodium\b/, /나트륨/g, '소듐'],
    [/\bCreate\b/, /만들기|창조|생성/g, '크리에이트'],
    [/\bCobblemon\b/i, /코블레몬|Cobblemon/gi, '코블몬'],
    [/\bPixelmon\b/i, /Pixelmon/gi, '픽셀몬'],
    [/\bOptiFine\b/i, /옵티\s*파인|Opti\s*정밀한/gi, '옵티파인'],
  );
  if (gameId === 'terraria') rules.push(
    [/Calamity|灾厄/i, /Calamity|재앙|재난|불행/gi, '칼라미티'],
    [/Thorium/i, /Thorium|토륨/gi, '토륨'],
  );
  if (gameId === 'rimworld') rules.push([/\bPawn\b|\bPawns\b/i, /전당포/g, '정착민']);
  for (const [source, target, replacement] of rules) if (source.test(original)) title = title.replace(target, replacement);
  // Some short package names are decoded as a sentence ending in a subject
  // particle. Only strip it after an explicit package/collection noun.
  if (!/[가-힣]/.test(original)) title = title.replace(/(모드팩|모드 팩|컬렉션|라이브러리|팩)(?:은|는)$/u, '$1');
  return title;
}
