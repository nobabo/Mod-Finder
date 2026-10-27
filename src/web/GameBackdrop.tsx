import { useMemo } from 'react';
import backgrounds from '../shared/data/game-theme-backgrounds.json';
import { Atmosphere } from './Atmosphere';
import { gameThemeFor } from './lib/game-themes';

export function GameBackdrop({ gameId, motionEnabled = true, scrollParallax = false }: { gameId: string; motionEnabled?: boolean; scrollParallax?: boolean }) {
  const theme = gameThemeFor(gameId);
  const appearance = useMemo(() => theme ? { canvas: theme.canvas, primary: theme.primary, secondary: theme.secondary, photoOpacity: .18 } : undefined, [theme]);
  return <Atmosphere gameIds={[gameId]} theme="game" photoCollection={backgrounds[gameId as keyof typeof backgrounds]} appearance={appearance} motionEnabled={motionEnabled} scrollParallax={scrollParallax} />;
}
