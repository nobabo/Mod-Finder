import { describe, expect, it } from 'vitest';
import { applySteamTranslationGlossary as correct } from '../lib/steam-translation-glossary.mjs';

describe('source-scoped Steam translation terminology', () => {
  it('corrects observed RimWorld terminology while retaining mod identifiers', () => {
    const original = "Protect colonists in your colony. Research tree. Numbers Trait AddOn shows traits in the Numbers panel.";
    expect(correct('rimworld', original, '식민지 주민을 식민지에서 보호합니다. 연구 나무. Numbers Trait AddOn은 숫자 패널에 특성을 표시합니다.'))
      .toBe('정착민을 정착지에서 보호합니다. 연구 트리. Numbers Trait AddOn은 Numbers 패널에 특성을 표시합니다.');
    expect(correct('rimworld', 'Your pawns rescue casualties.', '졸은 사상자를 구합니다. 졸이 걷고 졸을 돕습니다.'))
      .toBe('캐릭터는 사상자를 구합니다. 캐릭터가 걷고 캐릭터를 돕습니다.');
    expect(correct('rimworld', 'A chess board for pawns.', '졸은 체스 기물입니다.')).toBe('졸은 체스 기물입니다.');
  });
  it('requires the corresponding source term and game instead of replacing Korean globally', () => {
    expect(correct('rimworld', 'An ordinary tree.', '연구 나무와 식민지 주민')).toBe('연구 나무와 식민지 주민');
    expect(correct('terraria', 'A research tree for colonists.', '연구 나무와 식민지 주민')).toBe('연구 나무와 식민지 주민');
    expect(correct('another-game', 'Terraria bosses.', '테라 리아의 상사')).toBe('테라 리아의 상사');
    expect(correct('terraria', 'My boss plays Terraria at our workplace.', '테라 리아의 상사가 옵니다.')).toBe('테라리아의 상사가 옵니다.');
  });
  it('corrects repeated Terraria combat and artwork mistranslations', () => {
    expect(correct('terraria', 'Terraria: critically hit bosses. Visuals (sprites/textures).', '테라 리아: 비판적으로 상사를 공격합니다. 영상(스프레이 / 텍스처).'))
      .toBe('테라리아: 치명타로 보스를 공격합니다. 영상(스프라이트/텍스처).');
    expect(correct('terraria', 'A player can use the mod.', '선수는 모드를 사용합니다.')).toBe('플레이어는 모드를 사용합니다.');
    expect(correct('terraria', 'A football player.', '선수는 달립니다.')).toBe('선수는 달립니다.');
  });
  it('does not rewrite source mod names, URLs, inline code, or unrelated numbers', () => {
    const korean = 'Terraria Calamity Mod 상사와 싸웁니다. https://example.test/상사 `상사` 80/1.4.4';
    expect(correct('terraria', 'Terraria Calamity Mod fights bosses.', korean))
      .toBe('Terraria Calamity Mod 보스와 싸웁니다. https://example.test/상사 `상사` 80/1.4.4');
    expect(correct('project-zomboid', 'Project Zomboid Build 41.78.', '프로젝트 좀비 건설 41.78, 구축 42, 값 41.79'))
      .toBe('프로젝트 좀보이드 빌드 41.78, 구축 42, 값 41.79');
    expect(correct('project-zomboid', 'Build a house.', '건설 41')).toBe('건설 41');
  });
  it('keeps literal language when the named product or service is absent', () => {
    expect(correct('dont-starve-together', "Don't Starve Together mod.", '함께 굶지 마세요 모드')).toBe('돈 스타브 투게더 모드');
    expect(correct('dont-starve-together', 'Eat together.', '함께 굶지 마세요')).toBe('함께 굶지 마세요');
    expect(correct('cities-skylines', 'Cities: Skylines on Steam Workshop.', '도시: 스카이 라인. 스팀 작업장.')).toBe('시티즈: 스카이라인. Steam 창작마당.');
    expect(correct('cities-skylines', 'A railway workshop.', '스팀 작업장.')).toBe('스팀 작업장.');
  });
  it('fixes observed survival, zoning and dependency terms only with explicit source evidence', () => {
    expect(correct('project-zomboid', 'Foraging grants wider spotting distance, weather penalties, forageable items and crafting materials.', '먹이 찾기, 스팟 거리, 날씨 처벌, 먹이 항목, 공예 재료'))
      .toBe('채집, 발견 거리, 날씨 불이익, 채집 아이템, 제작 재료');
    expect(correct('cities-skylines', 'Level 2 Low Density Commercial.', '레벨 2 저밀도 광고')).toBe('레벨 2 저밀도 상업');
    expect(correct('cities-skylines', 'An advertisement.', '저밀도 광고')).toBe('저밀도 광고');
    expect(correct('dont-starve-together', 'Health 350, San 200, Hungry 150. Requires trailblazer for pathfinding.', '건강 350, 산 200, 배고픈 150. 길 찾기를 위한 선구자. 산 300.'))
      .toBe('체력 350, 정신력 200, 허기 150. 길 찾기용 trailblazer. 산 300.');
    expect(correct('dont-starve-together', 'San 300.', '산 200')).toBe('산 200');
  });
});
