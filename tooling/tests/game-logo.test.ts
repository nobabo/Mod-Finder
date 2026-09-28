import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync } from 'node:fs';
import { GAMES } from '../../src/shared/games';
import { GameLogo } from '../../src/web/components';

vi.mock('../../src/web/lib/i18n', () => ({ locale: 'ko', t: (value: string) => value }));

it('renders a bundled image for every search-box game, including games without an icon entry', () => {
  for (const game of GAMES) {
    const html = renderToStaticMarkup(createElement(GameLogo, { gameId: game.id }));
    const src = html.match(/<img[^>]+src="([^"]+)"/)?.[1];
    expect(src, game.id).toBeTruthy();
    expect(existsSync(`src/web/public${src}`), game.id).toBe(true);
    if (!game.image) expect(html).toContain('game-logo-wordmark');
  }
});
