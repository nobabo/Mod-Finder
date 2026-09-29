import { useEffect, useState } from 'react';
import { registerModSummaries, withReviewedSummaries, type SummaryTranslation } from '../../shared/mod-summaries';
import reviewed from '../../shared/locales/reviewed-mod-summaries.ko.json';

const files = import.meta.glob<{ default: SummaryTranslation[] }>('../../shared/locales/mod-summaries/*.json');
const reviewedSummaries = reviewed as unknown as Record<string, SummaryTranslation[]>;
const pending = new Map<string, Promise<void>>();
function load(gameId: string): Promise<void> {
  const existing = pending.get(gameId);
  if (existing) return existing;
  const loader = files[`../../shared/locales/mod-summaries/${gameId}.json`];
  if (!loader) return Promise.resolve();
  const task = loader().then(module => { registerModSummaries(gameId, withReviewedSummaries(module.default, reviewedSummaries[gameId] ?? [])); }).catch(error => {
    pending.delete(gameId); throw error;
  });
  pending.set(gameId, task);
  return task;
}

export function useModSummaries(gameIds: string[], enabled: boolean) {
  const [, refresh] = useState(0);
  const scope = JSON.stringify([...new Set(gameIds)].sort());
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void Promise.allSettled((JSON.parse(scope) as string[]).map(load)).then(() => {
      if (active) refresh(value => value + 1);
    });
    return () => { active = false; };
  }, [scope, enabled]);
}
