import { describe, expect, it } from 'vitest';
import { applyNexusTranslationGlossary as apply } from '../lib/nexus-translation-glossary.mjs';

describe('source-scoped Nexus translation repairs', () => {
  it('distinguishes footwear colors from computer booting and other games', () => {
    const source = 'I hate the fugly boot colors and their equally as ugly icons so I changed them.';
    expect(apply('stardew-valley', source, '부팅 색상과 아이콘을 변경했습니다.')).toBe('부츠 색상과 아이콘을 변경했습니다.');
    expect(apply('stardew-valley', 'Changes boot colors in the startup screen.', '부팅 색상')).toBe('부팅 색상');
    expect(apply('cyberpunk-2077', source, '부팅 색상')).toBe('부팅 색상');
  });
  it('restores a mod name only when that exact name appears in the original', () => {
    expect(apply('stardew-valley', 'Meals from Animal Husbandry mod.', '애완 동물 결혼 모드의 요리')).toBe('Animal Husbandry 모드의 요리');
    expect(apply('stardew-valley', 'Adds animal marriage.', '동물 결혼')).toBe('동물 결혼');
    expect(apply('skyrim-se', 'Animal Husbandry mod.', '동물 결혼')).toBe('동물 결혼');
  });
  it('distinguishes six NPCs from six letters and does not alter other counts', () => {
    const source = 'Animated hairstyles for 6 characters for use with Fashion Sense.';
    expect(apply('stardew-valley', source, '6 자 (현재)의 헤어스타일과 16자 메모')).toBe('6명 (현재)의 헤어스타일과 16자 메모');
    expect(apply('stardew-valley', 'Input 6 characters of text for an NPC.', '6자 입력')).toBe('6자 입력');
    expect(apply('stardew-valley', 'Support for 6 characters.', '6자')).toBe('6자');
  });
  it('recovers a missing maintenance negation without doubling correct negation', () => {
    const source = '*No longer updating* An expanded modpack.';
    expect(apply('stardew-valley', source, '* 더 이상 업데이트 * 확장 팩')).toBe('* 더 이상 업데이트하지 않습니다 * 확장 팩');
    expect(apply('stardew-valley', source, '더 이상 업데이트하지 않습니다.')).toBe('더 이상 업데이트하지 않습니다.');
    expect(apply('stardew-valley', source, '더 이상 업데이트를 제공하지 않습니다.')).toBe('더 이상 업데이트를 제공하지 않습니다.');
    expect(apply('stardew-valley', 'Frequent updates.', '더 이상 업데이트')).toBe('더 이상 업데이트');
  });
  it('uses Stardew relationship and Cyberpunk perk terminology only with matching source context', () => {
    expect(apply('stardew-valley', 'Includes 13 heart events.', '13개 심장 이벤트')).toBe('13개 호감도 이벤트');
    expect(apply('skyrim-se', 'Includes 13 heart events.', '13개 심장 이벤트')).toBe('13개 심장 이벤트');
    expect(apply('cyberpunk-2077', 'Add perks to vanilla perk trees.', '원작 특전 나무')).toBe('원작 특전 트리');
    expect(apply('cyberpunk-2077', 'Adds trees.', '특전 나무')).toBe('특전 나무');
    expect(apply('cyberpunk-2077', 'Adds NCART stations.', 'NCART 방송국')).toBe('NCART 역');
    expect(apply('cyberpunk-2077', 'Adds a radio station.', 'NCART 방송국')).toBe('NCART 방송국');
  });
  it('requires the original game name before repairing its known mistranslation', () => {
    expect(apply('stardew-valley', 'Stardew Valley mods.', 'Stardew 밸리 모드')).toBe('스타듀 밸리 모드');
    expect(apply('skyrim-se', 'Skyrim textures.', '스카이 림 텍스처')).toBe('스카이림 텍스처');
    expect(apply('cyberpunk-2077', 'Cyberpunk 2077 mods.', '사이버 펑크2077 모드')).toBe('사이버펑크 2077 모드');
    expect(apply('baldurs-gate-3', "Baldur's Gate 3 mods.", '발두르의 문 3 모드')).toBe('발더스 게이트 3 모드');
    expect(apply('fallout-4', 'Fallout 4 mods.', '낙진 4 모드')).toBe('폴아웃 4 모드');
    expect(apply('fallout-4', 'Radiation after a disaster.', '낙진 4 모드')).toBe('낙진 4 모드');
  });
  it('requires the technical phrase before changing insect terminology', () => {
    expect(apply('rimworld', 'Bug fixes for the UI.', 'UI 벌레 수정')).toBe('UI 버그 수정');
    expect(apply('rimworld', 'New insect behaviors.', '벌레 수정')).toBe('벌레 수정');
    expect(apply('unknown', 'Bug fixes.', '벌레 수정')).toBe('벌레 수정');
  });
  it('distinguishes playable character creation from Unicode character creation', () => {
    expect(apply('baldurs-gate-3', 'Adds presets to character creation.', '문자 생성 프리셋')).toBe('캐릭터 생성 프리셋');
    expect(apply('baldurs-gate-3', 'Unicode character creation in the font editor.', '문자 생성')).toBe('문자 생성');
    expect(apply('baldurs-gate-3', 'Adds a new font.', '문자 생성')).toBe('문자 생성');
  });
  it('distinguishes Baldurs Gate loot containers from anatomical chests', () => {
    expect(apply('baldurs-gate-3', 'Items in the camp chest and tutorial chest.', '캠프 가슴과 튜토리얼 가슴')).toBe('야영지 보관함과 튜토리얼 보관함');
    expect(apply('baldurs-gate-3', 'Chest pain at camp.', '캠프 가슴')).toBe('캠프 가슴');
    expect(apply('baldurs-gate-3', 'Camp chest pain.', '캠프 가슴')).toBe('캠프 가슴');
    expect(apply('skyrim-se', 'Items in the camp chest.', '캠프 가슴')).toBe('캠프 가슴');
  });
  it('distinguishes Fallout firearm receivers from radio receivers', () => {
    expect(apply('fallout-4', 'Changes firing sounds of automatic weapon receivers.', '자동 무기 수신기를 변경합니다.')).toBe('자동 무기 리시버를 변경합니다.');
    expect(apply('fallout-4', 'Adds a radio receiver.', '무기 수신기')).toBe('무기 수신기');
    expect(apply('fallout-4', 'A wireless weapon receiver sends a radio signal.', '무기 수신기')).toBe('무기 수신기');
    expect(apply('rimworld', 'Changes weapon receivers.', '무기 수신기')).toBe('무기 수신기');
  });
});
