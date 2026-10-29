import { describe, expect, it } from 'vitest';
import { applyThunderstoreTranslationGlossary as apply } from '../lib/thunderstore-translation-glossary.mjs';

describe('source-aware Thunderstore translation glossary', () => {
  it('repairs observed game and suit terminology without changing versions, quantities, or original text', () => {
    const source = 'Adds 9 Helldivers Models as Suits to Lethal Comapny. V81+';
    const translated = '9 Helldivers 모델을 치명적인 회사에 대한 소송으로 추가합니다. V81+';
    expect(apply('lethal-company', source, translated)).toBe('9 Helldivers 모델을 리썰 컴퍼니에 대한 슈트로 추가합니다. V81+');
    expect(source).toBe('Adds 9 Helldivers Models as Suits to Lethal Comapny. V81+');
  });
  it('requires noun and game context before correcting suits, preserving legal suits and unrelated prose', () => {
    expect(apply('lethal-company', 'Adds new player suits.', '새 소송을 추가합니다. 소송은 무료입니다.')).toBe('새 슈트를 추가합니다. 슈트는 무료입니다.');
    expect(apply('lethal-company', 'Adds new legal suits to the court.', '법원에 새로운 소송을 추가합니다.')).toBe('법원에 새로운 소송을 추가합니다.');
    expect(apply('lethal-company', 'This suits your playstyle.', '이 소송은 무료입니다.')).toBe('이 소송은 무료입니다.');
    expect(apply('minecraft-java', 'Adds new suits to Lethal Company.', '치명적인 회사에 소송을 추가합니다.')).toBe('치명적인 회사에 소송을 추가합니다.');
  });
  it('distinguishes shooting a gun from shooting a photo or a shooting star', () => {
    expect(apply('lethal-company', 'A chance to drop your gun after shooting.', '촬영 후 총을 떨어뜨릴 확률.')).toBe('사격 후 총을 떨어뜨릴 확률.');
    expect(apply('lethal-company', 'Shooting photos with the camera after finding a gun.', '총을 찾은 후 카메라로 촬영합니다.')).toBe('총을 찾은 후 카메라로 촬영합니다.');
    expect(apply('lethal-company', 'Adds shooting stars.', '별을 촬영합니다.')).toBe('별을 촬영합니다.');
  });
  it('repairs spawn rates and moon progression only when explicitly present in the source', () => {
    expect(apply('valheim', 'Customize spawn rates.', '산란 속도와 산란율을 바꿉니다.')).toBe('생성률과 생성률을 바꿉니다.');
    expect(apply('valheim', 'Fish breeding speed.', '물고기 산란 속도.')).toBe('물고기 산란 속도.');
    expect(apply('lethal-company', 'New Midgame Moon', '새로운 미드게임 문')).toBe('새로운 중반용 위성');
    expect(apply('lethal-company', 'New midgame door', '새로운 미드게임 문')).toBe('새로운 미드게임 문');
  });
  it('preserves names using exact source tokens and leaves ordinary words alone', () => {
    expect(apply('lethal-company', 'A fork of HealthMetrics using SoundAPI.', '체력 지표의 포크이며 사운드 API를 사용합니다.')).toBe('HealthMetrics의 포크이며 SoundAPI를 사용합니다.');
    expect(apply('lethal-company', 'Shows health metrics.', '체력 지표를 보여줍니다.')).toBe('체력 지표를 보여줍니다.');
    expect(apply('lethal-company', 'A fork of SuperHealthMetrics.', '체력 지표의 포크.')).toBe('체력 지표의 포크.');
  });
  it('keeps attribution and roulette meaning distinct from currency and ordinary language', () => {
    expect(apply('lethal-company', 'All credit goes to ExampleAuthor.', '모든 신용은 ExampleAuthor에게 있습니다.')).toBe('모든 공로는 ExampleAuthor에게 있습니다.');
    expect(apply('lethal-company', 'Spend 50 credits as currency.', '신용 50을 소비합니다.')).toBe('신용 50을 소비합니다.');
    expect(apply('lethal-company', 'A Russian Roulette mod.', '러시아어 룰렛 모드.')).toBe('러시안 룰렛 모드.');
    expect(apply('lethal-company', 'Russian language pack.', '러시아어 룰렛 모드.')).toBe('러시아어 룰렛 모드.');
  });
  it('distinguishes game cosmetics and convenience features from makeup and general health', () => {
    expect(apply('lethal-company', 'Cosmetic mods and quality of life features.', '화장품을 추가하고 삶의 질을 개선합니다.')).toBe('외형 꾸미기를 추가하고 편의성을 개선합니다.');
    expect(apply('lethal-company', 'Cosmetic products for makeup.', '화장품을 추가합니다.')).toBe('화장품을 추가합니다.');
    expect(apply('valheim', 'A medical quality of life assessment.', '삶의 질 평가입니다.')).toBe('삶의 질 평가입니다.');
    expect(apply('lethal-company', 'QOL changes and new emotes.', 'QOL 변경과 이모티콘입니다.')).toBe('편의 기능 변경과 감정 표현입니다.');
    expect(apply('lethal-company', 'Adds chat emotes.', '채팅 이모티콘입니다.')).toBe('채팅 이모티콘입니다.');
  });
  it('requires performance or immersion context for ambiguous words', () => {
    expect(apply('lethal-company', 'Increase FPS without stutters.', '말더듬이 없습니다.')).toBe('끊김이 없습니다.');
    expect(apply('lethal-company', 'The character stutters when speaking.', '말더듬이 있습니다.')).toBe('말더듬이 있습니다.');
    expect(apply('lethal-company', 'Without breaking immersion.', '침수를 깨지 않습니다.')).toBe('몰입을 깨지 않습니다.');
    expect(apply('valheim', 'Immersion in water.', '물에 침수됩니다.')).toBe('물에 침수됩니다.');
    expect(apply('lethal-company', 'An overhaul modpack.', '정밀 검사 모드팩입니다.')).toBe('전면 개편 모드팩입니다.');
  });
  it('translates standalone modpack words while preserving source identifiers and names', () => {
    expect(apply('lethal-company', 'A ModPack bundled with DarkbrewerysModpack.', 'ModPack은 DarkbrewerysModpack과 함께 사용합니다.')).toBe('모드팩은 DarkbrewerysModpack과 함께 사용합니다.');
    expect(apply('lethal-company', 'A pack.', 'ModPack을 사용합니다.')).toBe('ModPack을 사용합니다.');
  });
  it('distinguishes storage chests and game constitution from body armor and political law', () => {
    expect(apply('valheim', 'Craft items from nearby chests.', '가까운 가슴에서 공예를 합니다.')).toBe('가까운 상자에서 제작을 합니다.');
    expect(apply('valheim', 'Craft chest armor for your torso.', '가슴 갑옷을 공예합니다.')).toBe('가슴 갑옷을 제작합니다.');
    expect(apply('valheim', 'Adds a "Constitution" skill which adjusts health and stamina.', '헌법에 따라 건강과 체력을 조정합니다.')).toBe('체질(Constitution)에 따라 건강과 체력을 조정합니다.');
    expect(apply('valheim', 'A political constitution.', '헌법을 추가합니다.')).toBe('헌법을 추가합니다.');
    expect(apply('valheim', 'Arts and crafts.', '공예를 추가합니다.')).toBe('공예를 추가합니다.');
  });
  it('distinguishes character skins and Discord communities from body care and interpersonal discord', () => {
    expect(apply('risk-of-rain-2', 'Skin that changes Bandit into Niko.', '밴딧의 피부를 바꿉니다.')).toBe('밴딧의 스킨을 바꿉니다.');
    expect(apply('risk-of-rain-2', 'New skin care for injuries.', '피부를 치료합니다.')).toBe('피부를 치료합니다.');
    expect(apply('lethal-company', 'Mods of the SNFBJG discord.', 'SNFBJG 불화의 모드.')).toBe('SNFBJG 디스코드의 모드.');
    expect(apply('lethal-company', 'Create discord among players.', '플레이어 사이에 불화가 생깁니다.')).toBe('플레이어 사이에 불화가 생깁니다.');
    expect(apply('valheim', 'A pre-configured Quality-of-Life pack.', 'Quality-of-Life 팩.')).toBe('편의 기능 팩.');
    expect(apply('risk-of-rain-2', 'Adjust Risk of Rain.', '비의 위험을 조정합니다.')).toBe('리스크 오브 레인을 조정합니다.');
  });
  it('does not introduce changes on a second pass or when source evidence is absent', () => {
    const source = 'Adds suits to Lethal Company with spawn rates.';
    const once = apply('lethal-company', source, '치명적인 회사의 소송과 산란 속도.');
    expect(apply('lethal-company', source, once)).toBe(once);
    expect(apply('lethal-company', 'No matching English terms.', '치명적인 회사에서 촬영과 소송, 산란 속도를 다룹니다.')).toBe('치명적인 회사에서 촬영과 소송, 산란 속도를 다룹니다.');
  });
});
