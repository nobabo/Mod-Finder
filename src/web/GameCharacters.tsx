import type { GameTheme } from './lib/game-themes';

export function GameCharacters({ theme }: { theme: GameTheme }) {
  return <div className={`game-characters characters-${theme.id}`} aria-hidden="true">
    {theme.characters.map(character => <span key={character.name} className={`game-character character-${character.name} ${character.name === theme.representative ? 'is-representative' : 'is-companion'}`}>
      <img src={character.src} width={character.width} height={character.height} alt="" draggable={false} decoding="async" />
    </span>)}
  </div>;
}
