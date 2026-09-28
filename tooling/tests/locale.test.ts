import { describe, expect, it } from 'vitest';
import { browserLocale, cookieLocale, LANGUAGES, resolveLocale } from '../../src/shared/locale';
import { dictionaries, english, translate } from '../../src/shared/translations';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

describe('country-based language', () => {
  it('supports seven languages and browser region tags', () => {
    for (const language of LANGUAGES) expect(cookieLocale(`mf-language=${language.id}`)).toBe(language.id);
    expect(browserLocale('ja-JP')).toBe('ja'); expect(browserLocale('zh-Hans-CN')).toBe('zh-CN');
    expect(browserLocale('es-MX')).toBe('es'); expect(browserLocale('it-IT')).toBe('en');
    expect(resolveLocale('DE',null)).toBe('de'); expect(resolveLocale('FR',null)).toBe('fr');
  });
  it('covers all UI keys and preserves interpolation tokens in every language', () => {
    const tokens = (text: string) => [...text.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
    for (const [language,dictionary] of Object.entries(dictionaries)) for (const [key,text] of Object.entries(english)) {
      expect(dictionary[key], `${language}: ${key}`).toBeTruthy();
      expect(tokens(dictionary[key]), `${language}: ${key}`).toEqual(tokens(text));
    }
    expect(translate('ja','{count}개 게임 완료',{count:3})).toBe('3ゲームを検索済み');
  });
  it.each([['KR', 'ko'], ['US', 'en'], ['JP', 'ja'], [undefined, 'en'], ['XX', 'en']])('uses %s -> %s without a preference', (country, expected) => {
    expect(resolveLocale(country, null)).toBe(expected);
  });
  it('lets an explicit language override country, ignoring invalid cookies', () => {
    expect(resolveLocale('KR', 'other=1; mf-language=en')).toBe('en');
    expect(resolveLocale('US', 'mf-language=ko; other=1')).toBe('ko');
    expect(resolveLocale('KR', 'mf-language=invalid')).toBe('ko');
    expect(resolveLocale('US', 'mf-language=')).toBe('en');
  });
  it('formats complete sentences without translating provider text', () => {
    expect(translate('en', '{count}개 모드 선택', { count: 2 })).toBe('Selected mods: 2');
    expect(translate('ko', '{game}의 어떤 모드를 찾고 있나요?', { game: 'Minecraft' })).toBe('Minecraft의 어떤 모드를 찾고 있나요?');
    expect(translate('en', '제작자가 쓴 모드 이름')).toBe('제작자가 쓴 모드 이름');
  });
  it('has English translations for every literal application message', () => {
    for (const path of ['src/web/App.tsx', 'src/web/components.tsx', 'src/web/SettingsMenu.tsx', 'src/web/GameDeck.tsx', 'src/web/lib/api.ts', 'src/web/lib/search.ts', 'src/server/adapters.ts']) {
      const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        if (ts.isStringLiteral(node) && /[가-힣]/.test(node.text) && node.text !== '한국어') {
          expect(english[node.text], `${path}: ${node.text}`).toBeDefined();
        }
        ts.forEachChild(node, visit);
      }
      visit(file);
    }
  });
});
