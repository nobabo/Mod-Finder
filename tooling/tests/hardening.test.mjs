import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { nativeSecurityConfig } from '../lib/native-config.mjs';
import { validateCatalogText, readTranslationResponse } from '../lib/catalog-text.mjs';

describe('release and catalog boundaries', () => {
  it('permits only the configured HTTPS origin in a native release', () => {
    const csp = nativeSecurityConfig('https://api.example.org').app.security.csp;
    expect(csp).toContain('http://ipc.localhost https://api.example.org;');
    expect(csp).not.toContain('connect-src https:');
    for (const endpoint of ['http://api.example.org', 'https://127.0.0.1', 'https://localhost', 'https://[::1]', 'https://user:pass@api.example.org', 'https://api.example.org/?secret=value', 'https://api.example.org;object-src']) {
      expect(() => nativeSecurityConfig(endpoint)).toThrow();
    }
  });
  it('rejects hidden controls and excessive translations while retaining multilingual text', () => {
    expect(validateCatalogText('한글 日本語 العربية\n  café', 'test')).toBe('한글 日本語 العربية\n  café');
    for (const value of ['mod\u202eexe', 'mod\u0000title', 'mod\u2066hidden', 'a'.repeat(3601), 42]) expect(() => validateCatalogText(value, 'test')).toThrow();
  });
  it('validates translator response shape and cancels oversized bodies', async () => {
    expect(await readTranslationResponse(Response.json([[['번역', 'source'], [' 결과', 'source']]]))).toBe('번역 결과');
    await expect(readTranslationResponse(Response.json({ result: 'invalid' }))).rejects.toThrow();
    await expect(readTranslationResponse(new Response(' '.repeat(256 * 1024 + 1)))).rejects.toThrow('exceeds limit');
  });
  it('ships licensed fonts whose bytes match the local stylesheet manifest', () => {
    const directory = new URL('../../src/web/public/fonts/', import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('sources.json', directory), 'utf8'));
    const css = readFileSync(new URL('fonts.css', directory), 'utf8');
    expect(css).not.toMatch(/https?:\/\//);
    for (const font of manifest.fonts) {
      expect(font.file).toMatch(/^[a-f0-9]{20}\.woff2$/);
      const bytes = readFileSync(new URL(font.file, directory));
      expect(bytes.subarray(0, 4).toString()).toBe('wOF2');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(font.sha256);
      expect(css).toContain(`/fonts/${font.file}`);
    }
    for (const family of ['chirongoroundtc', 'notosanskr', 'kulimpark', 'notosansjp', 'notosanssc']) expect(readFileSync(new URL(`${family}-OFL.txt`, directory), 'utf8')).toContain('SIL OPEN FONT LICENSE');
  });
});
