import { BACKGROUNDS } from '../shared/backgrounds';

export function GameBackdrop({ gameId }: { gameId: string }) {
  const photo = BACKGROUNDS[gameId]?.screenshots[0];
  return <div className="atmosphere game-atmosphere" aria-hidden="true">
    {photo && <img className="game-backdrop-photo" src={photo.src} alt="" decoding="async" />}
  </div>;
}
