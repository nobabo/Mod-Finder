import type { Source } from './types';

export interface ModCategory { id: string; source: Source; value: string; ko: string; en: string }
// Provider categories are game-scoped. Names are never used to merge listings or
// to guess equivalent categories on another provider. Reference pages checked 2026-09-26.
const define = (source: Source, entries: [string, string, string?][]): ModCategory[] => entries.map(([value, ko, en]) => ({
  id: `${source}:${value}`, source, value, ko, en: en ?? value,
}));
export const GAME_CATEGORIES: Record<string, ModCategory[]> = {
  'minecraft-java': define('modrinth', [
    ['adventure','모험','Adventure'], ['technology','기술','Technology'], ['magic','마법','Magic'],
    ['optimization','최적화','Optimization'], ['decoration','장식','Decoration'], ['worldgen','월드 생성','World Generation'],
    ['mobs','생물','Mobs'], ['equipment','장비','Equipment'], ['food','음식','Food'],
    ['storage','보관','Storage'], ['transportation','이동 수단','Transportation'], ['utility','편의 기능','Utility'],
    ['library','라이브러리','Library'], ['game-mechanics','게임 시스템','Game Mechanics'],
  ]),
  'stardew-valley': define('nexus', [
    ['Buildings','건물'], ['Characters','캐릭터'], ['New Characters','새 캐릭터'], ['Crops','작물'],
    ['Fishing','낚시'], ['Furniture','가구'], ['Dialogue','대화'], ['Events','이벤트'],
    ['Expansions','확장 콘텐츠'], ['Clothing','의상'], ['Crafting','제작'], ['Audio','오디오'], ['Cheats','치트'],
    ['Portraits','초상화'], ['Pets / Horses','반려동물·말'], ['Livestock and Animals','가축·동물'],
    ['Maps','지도'], ['Gameplay Mechanics','게임 시스템'], ['User Interface','인터페이스'],
  ]),
  'skyrim-se': define('nexus', [
    ['Armour','방어구'], ['Weapons','무기'], ['Animation','애니메이션'], ['Alchemy','연금술'],
    ['Quests and Adventures','퀘스트·모험'], ['Races, Classes, and Birthsigns','종족·직업·별자리'],
    ['Skills and Leveling','스킬·레벨'], ['Shouts','포효'], ['Stealth','은신'],
    ['Body, Face, and Hair','외형'], ['User Interface','인터페이스'], ['Visuals and Graphics','그래픽'], ['Bug Fixes','버그 수정'],
  ]),
  'lethal-company': define('thunderstore', [
    ['690','위성','Moons'], ['767','실내','Interiors'], ['689','괴물','Monsters'], ['688','아이템','Items'],
    ['686','슈트','Suits'], ['692','외형','Cosmetics'], ['713','감정 표현','Emotes'], ['687','장비','Equipment'],
    ['691','가구','Furniture'], ['720','붐박스 음악','Boombox Music'], ['868','날씨','Weather'],
    ['869','위험 요소','Hazards'], ['871','성능','Performance'], ['872','편의 기능','Tweaks & Quality Of Life'],
  ]),
  'valheim': define('thunderstore', [
    ['457','건축','Building'], ['26','제작','Crafting'], ['21','장비','Gear'], ['20','적','Enemies'],
    ['613','NPC','NPCs'], ['644','월드 생성','World Generation'], ['455','탈것','Vehicles'],
    ['456','이동 수단','Transportation'], ['454','PvP','PvP'], ['25','스킨','Skins'], ['42','편의 기능','Utility'],
    ['19','게임 조정','Tweaks'], ['28','오디오','Audio'], ['27','언어','Language'],
  ]),
  'risk-of-rain-2': define('thunderstore', [
    ['7','생존자','Player Characters'], ['132','스킬','Skills'], ['9','아이템','Items'], ['14','유물','Artifacts'],
    ['12','적','Enemies'], ['91','게임 모드','Gamemodes'], ['6','맵','Maps'], ['5','스킨','Skins'],
    ['235','감정 표현','Emotes'], ['8','게임 조정','Tweaks'], ['11','오디오','Audio'], ['10','언어','Language'],
  ]),
  'rimworld': define('steam', [['Mod','모드'], ['Translation','번역'], ['Scenario','시나리오']]),
  'terraria': define('steam', [
    ['Adventure Worlds','모험 월드'], ['Golf Worlds','골프 월드'], ['All Items Worlds','모든 아이템 월드'],
    ['Starter Worlds','시작 월드'], ['Journey Worlds','여행 월드'], ['Challenge Worlds','도전 월드'],
    ['From Terraria Mods','모드 기반 리소스'], ['High Resolution','고해상도'], ['Music','음악'],
    ['Language/Translations','번역'], ['Overhaul','전체 개편'], ['Tweaks','세부 조정'],
  ]),
  'project-zomboid': define('steam', [
    ['Map','지도'], ['Vehicles','차량'], ['Weapons','무기'], ['Clothing/Armor','의상·방어구'],
    ['Building','건축'], ['Farming','농사'], ['Food','음식'], ['Animals','동물'], ['Traits','특성'],
    ['Skills','스킬'], ['Interface','인터페이스'], ['QoL','편의 기능'], ['Multiplayer','멀티플레이'],
    ['Language/Translation','번역'], ['Balance','밸런스'], ['Framework','프레임워크'],
  ]),
  'cities-skylines': define('steam', [
    ['Map','지도'], ['Mod','모드'], ['SaveGame','저장 게임'], ['District Style','지구 스타일'],
    ['Map Theme','지도 테마'], ['Scenario','시나리오'], ['Building','건물'], ['Prop','소품'], ['Tree','나무'],
    ['Vehicle','차량'], ['Intersection','교차로'], ['Park','공원'], ['Transport','교통'],
    ['Residential','주거'], ['Commercial','상업'], ['Industrial','산업'], ['Office','사무실'],
  ]),
  'dont-starve-together': define('steam', [
    ['character','캐릭터','Character'], ['item','아이템','Item'], ['pet','펫','Pet'], ['creature','생물','Creature'],
    ['environment','환경','Environment'], ['interface','인터페이스','Interface'], ['utility','편의 기능','Utility'],
    ['art','아트','Art'], ['worldgen','월드 생성','World Generation'], ['tweak','게임 조정','Tweak'],
    ['scenario','시나리오','Scenario'], ['language','언어','Language'],
  ]),
  'cyberpunk-2077': define('nexus', [
    ['Appearance','외형'], ['Armour and Clothing','방어구·의상'], ['Gameplay','게임플레이'],
    ['Characters','캐릭터'], ['Animations','애니메이션'], ['Audio','오디오'], ['Locations','장소'],
    ['Vehicles','차량'], ['Weapons','무기'], ['User Interface','인터페이스'], ['Visuals and Graphics','그래픽'],
    ['Props and Decorations','소품·장식'], ['Scripts','스크립트'], ['Utilities','유틸리티'],
  ]),
  'baldurs-gate-3': define('nexus', [
    ['Classes','직업'], ['Character Customisation','캐릭터 꾸미기'], ['Companions','동료'], ['Dice','주사위'],
    ['Equipment','장비'], ['Armor','방어구'], ['Accessories','장신구'], ['Clothing','의상'],
    ['Gameplay','게임플레이'], ['Maps','지도'], ['Animations','애니메이션'], ['Audio','오디오'],
  ]),
  'fallout-4': define('nexus', [
    ['Player Settlement','정착지'], ['Sim Settlements 2','심 세틀먼트 2'], ['Power Armour','파워 아머'],
    ['Armour','방어구'], ['Ammo','탄약'], ['Companions','동료'], ['Perks','특성'], ['Pip-Boy','핍보이'],
    ['Crafting - Home/Settlement','정착지 제작'], ['Quests and Adventures','퀘스트·모험'],
    ['Radio','라디오'], ['Creatures','생물'], ['Factions','세력'], ['User Interface','인터페이스'],
    ['Weapons','무기'], ['Weapons and Armour','무기·방어구'], ['Weather and Lighting','날씨·조명'],
  ]),
};
export const categoriesForGame = (gameId: string): ModCategory[] => GAME_CATEGORIES[gameId] ?? [];
export const getCategory = (gameId: string, id?: string) => categoriesForGame(gameId).find(category => category.id === id);
