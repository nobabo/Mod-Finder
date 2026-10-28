import { ArtworkReaction } from './ArtworkReaction';
import { MovableArtwork } from './MovableArtwork';
import { artworkForGame } from './lib/game-artwork';
import { getGame } from '../shared/games';
import { locale } from './lib/i18n';
import { useScenePaused } from './lib/use-scene-paused';

export function GameCharacters({ gameId }: { gameId: string }) {
  const paused = useScenePaused();
  const theme = artworkForGame(gameId);
  if (!theme) return null;
  const game = getGame(gameId)!;
  return <div className={`game-characters game-characters-search characters-${theme.id}`}>
    {theme.characters.map((character,index) => <MovableArtwork key={`${gameId}:${character.name}`} id={`${gameId}:${character.name}`} width={character.width} height={character.height} displayWidth={character.displayWidth} themeClass={`characters-${theme.id}`} label={`${locale === 'ko' ? game.koreanName : game.name} ${locale === 'ko' ? character.ko : character.en}`} paused={paused} className={`game-character character-${character.name} artwork-search-${index ? 'right' : 'left'} ${character.pixelated ? 'is-pixel-art' : ''} ${index ? 'is-companion' : 'is-representative'}`}>
      <ArtworkReaction className="character-art"><span className="character-cutout" style={{aspectRatio:`${character.width}/${character.height}`}}><img src={character.src} width={character.imageWidth} height={character.imageHeight} alt="" draggable={false} decoding="async" style={{left:`${-character.crop[0]/character.width*100}%`,top:`${-character.crop[1]/character.height*100}%`,width:`${character.imageWidth/character.width*100}%`,height:`${character.imageHeight/character.height*100}%`}} /></span></ArtworkReaction>
    </MovableArtwork>)}
  </div>;
}
