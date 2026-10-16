import { GAMES } from '../../shared/games';
import { SOURCES, type Source } from '../../shared/types';

export function detailReference(key: string) {
  const [source, scope, ...rest] = key.split(':');
  const id = rest.join(':');
  if (!SOURCES.includes(source as Source) || !id || id.length > 257 || /[\/\\\u0000-\u001f]/.test(id)) return null;
  const game = GAMES.find(game => game.sources[source as Source]?.scope === scope);
  return game ? { source: source as Source, scope, id, key, gameId: game.id } : null;
}
