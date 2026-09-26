import { useEffect, useState } from 'react';
import { registerModSummaries, type SummaryTranslation } from '../../shared/mod-summaries';

const files = import.meta.glob<{ default: SummaryTranslation[] }>('../../shared/locales/mod-summaries/*.json');
const pending = new Map<string, Promise<void>>();
function load(gameId: string): Promise<void> {
  const existing = pending.get(gameId);
  if (existing) return existing;
  const loader = files[`../../shared/locales/mod-summaries/${gameId}.json`];
  if (!loader) return Promise.resolve();
  const task = loader().then(module => { registerModSummaries(gameId, module.default); }).catch(error => {
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
