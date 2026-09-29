import { describe, expect, it } from 'vitest';
import { translationSnapshot, type ExportMod } from '../scripts/export-curseforge-translations';
import { projectLinks } from '../scripts/verify-minecraft-project-links';

const item = (id: number, name = 'Example'): ExportMod => ({ id, gameId: 432, classId: 6, name, summary: 'Original <text> 그대로', downloadCount: 100 - id, links: { websiteUrl: 'https://www.curseforge.com/minecraft/mc-mods/example' } });
describe('CurseForge translation export', () => {
  it('preserves exact summaries and duplicate titles without losing entries', () => {
    const result = translationSnapshot([item(1), item(2), item(3, 'Example [curseforge:432:2]'), item(4, '__proto__')], 6, 4);
    expect(Object.keys(result.content)).toHaveLength(4);
    expect(Object.values(result.content)).toEqual(Array(4).fill('Original <text> 그대로'));
    expect(result.manifest.map(row => row.listingKey)).toEqual([1, 2, 3, 4].map(id => `curseforge:432:${id}`));
    expect(result.manifest.every(row => result.content[row.key] === 'Original <text> 그대로')).toBe(true);
  });
  it('rejects partial, duplicate, mixed-class and incorrectly ranked snapshots', () => {
    expect(() => translationSnapshot([item(1)], 6)).toThrow();
    expect(() => translationSnapshot([item(1), item(1)], 6, 2)).toThrow();
    expect(() => translationSnapshot([item(1)], 4471, 1)).toThrow();
    expect(() => translationSnapshot([item(2), item(1)], 6, 2)).toThrow();
  });
});

describe('verified Minecraft cross-site links', () => {
  const candidates = [{ listingKey: 'curseforge:432:123', name: 'Example', url: item(1).links.websiteUrl }];
  const project = { id: 'abc', title: 'Example', body: `[CurseForge](${candidates[0].url})`, project_type: 'mod' };
  it('requires both an explicit source link and a matching original title', () => {
    expect(projectLinks(project, candidates)[0].listingKeys).toEqual(['modrinth:minecraft:abc', 'curseforge:432:123']);
    expect(projectLinks({ ...project, body: '' }, candidates)).toEqual([]);
    expect(projectLinks({ ...project, title: 'Dependency consumer' }, candidates)).toEqual([]);
    expect(projectLinks({ ...project, body: project.body.replace('curseforge.com', 'curseforge.com.evil.test') }, candidates)).toEqual([]);
    expect(projectLinks(project, [...candidates, { ...candidates[0], listingKey: 'curseforge:432:456' }])).toEqual([]);
  });
  it('accepts the same declared repository but rejects profiles and different repositories', () => {
    const a = { ...project, body: '', source_url: 'https://github.com/owner/repo' };
    const b = [{ ...candidates[0], sourceUrl: 'https://github.com/owner/repo.git' }];
    expect(projectLinks(a, b)).toHaveLength(1);
    expect(projectLinks(a, [{ ...b[0], sourceUrl: 'https://github.com/owner/other' }])).toEqual([]);
    expect(projectLinks({ ...a, source_url: 'https://github.com/owner' }, [{ ...b[0], sourceUrl: 'https://github.com/owner' }])).toEqual([]);
  });
});
