import type { GameTheme } from './lib/game-themes';
import { ArtworkReaction } from './ArtworkReaction';

export function GameCharacters({ theme, placement = 'search' }: { theme: GameTheme; placement?: 'search' | 'ranking' }) {
  const characters = theme.characters.filter(character => (character.name === theme.representative) === (placement === 'search'));
  return <div className={`game-characters game-characters-${placement} characters-${theme.id}`} aria-hidden="true">
    {characters.map((character, index) => <span key={character.name} className={`game-character character-${character.name} ${placement === 'search' ? 'is-representative' : `is-companion companion-${index}`}`}>
      <ArtworkReaction className="character-art"><img src={character.src} width={character.width} height={character.height} alt="" draggable={false} decoding="async" /></ArtworkReaction>
    </span>)}
  </div>;
}
