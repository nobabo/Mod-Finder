import snapshots from './data/community-rankings.json';
import type { CommunitySnapshot } from './community-ranking';

export function communityRanking(gameId: string): CommunitySnapshot | undefined {
  return (snapshots as Record<string, CommunitySnapshot>)[gameId];
}
