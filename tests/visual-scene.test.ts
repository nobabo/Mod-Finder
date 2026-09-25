import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { GAMES } from '../shared/games';
import { BACKGROUNDS, backgroundPlaylist } from '../shared/backgrounds';
import logos from '../shared/data/logos.json';
import { advanceVelocity, edgeIntent, edgeRamp } from '../src/lib/deck-motion';

describe('game imagery', () => {
  it('ships six distinct local screenshots and a real logo for every game', () => {
    for (const game of GAMES) {
      const collection = BACKGROUNDS[game.id];
      expect(collection.screenshots).toHaveLength(6);
      expect(new Set(collection.screenshots.map(s => s.sourceUrl)).size).toBe(6);
      for (const screenshot of collection.screenshots) {
        expect(screenshot.width).toBeGreaterThanOrEqual(800);
        expect(screenshot.height).toBeGreaterThan(400);
        expect(existsSync(`public${screenshot.src}`)).toBe(true);
        expect(screenshot.sourceUrl).toMatch(/^https:\/\//);
      }
      const logo = (logos as Record<string, { src: string }>)[game.id];
      expect(existsSync(`public${logo.src}`)).toBe(true);
    }
  });
  it('uses only the chosen game and interleaves games in the global view', () => {
    const selected = backgroundPlaylist(['valheim']);
    expect(selected).toHaveLength(6); expect(selected.every(s => s.gameId === 'valheim')).toBe(true);
    expect(backgroundPlaylist(['valheim','rimworld']).slice(0,4).map(s => s.gameId)).toEqual(['valheim','rimworld','valheim','rimworld']);
    expect(backgroundPlaylist(['invalid'])).toEqual([]);
  });
});
describe('game deck movement', () => {
  it('starts at zero and gradually opens the acceleration envelope', () => {
    expect(edgeRamp(0)).toBe(0); expect(edgeRamp(.1)).toBeLessThan(.04);
    expect(edgeRamp(.45)).toBeCloseTo(.5); expect(edgeRamp(.9)).toBe(1);
    let velocity=0;const distances=[0,0,0];
    for(let frame=0;frame<180;frame++) { velocity=advanceVelocity(velocity,1,1/60,frame/60);distances[Math.floor(frame/60)]+=velocity/60; }
    expect(distances[0]).toBeLessThan(distances[1]);expect(distances[1]).toBeLessThan(distances[2]);
  });
  it('moves only within edge zones and supports both directions', () => {
    expect(edgeIntent(500,1000)).toBe(0);
    expect(edgeIntent(750,1000)).toBeGreaterThan(0);
    expect(edgeIntent(250,1000)).toBeLessThan(0);
    expect(edgeIntent(1000,1000)).toBe(1);
    expect(edgeIntent(0,1000)).toBe(-1);
    expect(edgeIntent(950,1000)).toBeGreaterThan(edgeIntent(850,1000));
    expect(edgeIntent(390,390)).toBe(1);
  });
  it('accelerates gradually, caps speed and brakes when leaving the edge', () => {
    let speed = 0; const first = advanceVelocity(speed,1,1/60);
    for(let i=0;i<300;i++) speed = advanceVelocity(speed,1,1/60);
    expect(first).toBeLessThan(12); expect(speed).toBeGreaterThan(500); expect(speed).toBeLessThan(620);
    for(let i=0;i<60;i++) speed = advanceVelocity(speed,0,1/60);
    expect(speed).toBeLessThan(1);
    expect(advanceVelocity(0,1,10)).toBeLessThan(35);
  });
});
