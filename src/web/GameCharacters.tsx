import { ArtworkReaction } from './ArtworkReaction';
import { MovableArtwork } from './MovableArtwork';
import { artworkForGame } from './lib/game-artwork';
import { getGame } from '../shared/games';
import { locale } from './lib/i18n';
import { useScenePaused } from './lib/use-scene-paused';

export function GameCharacters({ gameId, placement = 'search' }: { gameId: string; placement?: 'search' | 'ranking' }) {
  const paused = useScenePaused();
  const theme = artworkForGame(gameId);
  if (!theme) return null;
  const game = getGame(gameId)!;
  const characters = theme.characters.filter(character => character.anchor.startsWith(placement));
  return <div className={`game-characters game-characters-${placement} characters-${theme.id}`}>
    {characters.map(character => <MovableArtwork key={`${gameId}:${character.name}`} id={`${gameId}:${character.name}`} width={character.width} height={character.height} themeClass={`characters-${theme.id}`} label={`${locale === 'ko' ? game.koreanName : game.name} ${character.logo ? '' : character.name}`.trim()} paused={paused} className={`game-character character-${character.name} artwork-${character.anchor} ${character.logo ? `is-game-wordmark logo-${gameId}` : ''} ${character.name === theme.representative ? 'is-representative' : 'is-companion'}`}>
      <ArtworkReaction className="character-art"><img src={character.src} width={character.width} height={character.height} alt="" draggable={false} decoding="async" /></ArtworkReaction>
    </MovableArtwork>)}
  </div>;
}
