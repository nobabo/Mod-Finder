import { useMemo } from 'react';
import backgrounds from '../shared/data/game-theme-backgrounds.json';
import { Atmosphere } from './Atmosphere';
import { sceneAppearance } from './lib/themes';

export function GameBackdrop({ gameId, backgroundColor, photoColor, onPhotoColor, motionEnabled = true, scrollParallax = false }: { gameId: string; backgroundColor?: string; photoColor?: string; onPhotoColor?: (color: string) => void; motionEnabled?: boolean; scrollParallax?: boolean }) {
  const appearance = useMemo(() => sceneAppearance('game', gameId, backgroundColor, photoColor), [gameId, backgroundColor, photoColor]);
  return <Atmosphere gameIds={[gameId]} theme="game" photoCollection={backgrounds[gameId as keyof typeof backgrounds]} appearance={appearance} onPhotoColor={onPhotoColor} motionEnabled={motionEnabled} scrollParallax={scrollParallax} effectsEnabled={false} />;
}
