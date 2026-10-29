import { expect, it } from 'vitest';
import { applyMinecraftTranslationGlossary as apply } from '../lib/minecraft-translation-glossary.mjs';

it('distinguishes loader and metallurgy terminology using their source phrases', () => {
  expect(apply('minecraft-java', 'A forge mod that adds boxes.', '상자를 추가하는 단조 모드')).toBe('상자를 추가하는 포지 모드');
  expect(apply('minecraft-java', 'Forge some alloys.', '몇몇 합금을 위조하십시오')).toBe('몇몇 합금을 제련하십시오');
  expect(apply('minecraft-java', 'Adds a forge building.', '대장간 건물')).toBe('대장간 건물');
});
it('keeps chemistry, anatomy and library buildings when the technical context is absent', () => {
  expect(apply('minecraft-java', 'More FPS than sodium.', '나트륨보다 더 많은 FPS')).toBe('소듐보다 더 많은 FPS');
  expect(apply('minecraft-java', 'Adds sodium ore.', '나트륨 광석')).toBe('나트륨 광석');
  expect(apply('minecraft-java', 'Iris shaders support.', '홍채 셰이더 지원')).toBe('아이리스 셰이더 지원');
  expect(apply('minecraft-java', 'Adds iris colors.', '홍채 색상')).toBe('홍채 색상');
  expect(apply('minecraft-java', 'Library with shared code for other mods.', '공유 코드 도서관')).toBe('공유 코드 라이브러리');
  expect(apply('minecraft-java', 'Adds a village library.', '마을 도서관')).toBe('마을 도서관');
});
it('repairs observed game nouns while preserving versions and other games', () => {
  expect(apply('minecraft-java', 'Minecraft modpack with mobs for Fabric 1.20.1.', 'Minecraft modpack, 직물 1.20.1 폭도')).toBe('마인크래프트 모드팩, 패브릭 1.20.1 몹');
  expect(apply('valheim', 'Fabric mod with mobs.', '직물 폭도')).toBe('직물 폭도');
  expect(apply('minecraft-java', 'A historical crowd scene.', '폭도')).toBe('폭도');
});
