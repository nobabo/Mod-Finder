import { useMemo } from 'react';
import backgrounds from '../shared/data/game-theme-backgrounds.json';
import { Atmosphere } from './Atmosphere';
import { sceneAppearance } from './lib/themes';

export function GameBackdrop({ gameId, backgroundColor, motionEnabled = true, scrollParallax = false }: { gameId: string; backgroundColor?: string; motionEnabled?: boolean; scrollParallax?: boolean }) {
  const appearance = useMemo(() => sceneAppearance('game', gameId, backgroundColor), [gameId, backgroundColor]);
  return <Atmosphere gameIds={[gameId]} theme="game" photoCollection={backgrounds[gameId as keyof typeof backgrounds]} appearance={appearance} motionEnabled={motionEnabled} scrollParallax={scrollParallax} effectsEnabled={false} />;
}
