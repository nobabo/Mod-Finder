import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import review from '../data/search-trends.json';
import { searchPlan, runSearchQueue } from '../../src/shared/search-plan';
import { groupResults, keywordRelevance } from '../../src/shared/ranking';
import type { Listing, SearchRequest, SearchResult, Source } from '../../src/shared/types';

const base = process.argv.find(argument => argument.startsWith('https://')) ?? 'https://modfinder.pages.dev';
const localPlan = process.argv.includes('--local-plan');
const all = process.argv.includes('--all');
const checks = [];
async function json(path:string) {
  const response = await fetch(new URL(path,base), { signal:AbortSignal.timeout(60000) });
  assert.equal(response.status,200,path.split('?')[0]);
  return response.json();
}
for (const entry of review.entries.filter(entry => all || 'live' in entry && entry.live)) {
  const query = entry.aliases[0];
  for (const source of [...new Set(entry.projects.map(project => project.source as Source))]) {
    const filters: Record<string,string> = entry.gameId === 'minecraft-java' ? { kind:'mod' } : {};
    const plan = localPlan ? { original:searchPlan({ gameId:entry.gameId, selectedSource:source, query, filters, sort:'relevance' }) }
      : await json('/v1/search-plan?' + new URLSearchParams({gameId:entry.gameId,query,...filters})) as { original:SearchRequest[] };
    const requests = plan.original.filter(request => request.source === source);
    const items = new Map<string,Listing>();
    const statuses:{query:string; status:string}[] = [];
    await runSearchQueue(requests, async request => {
      const params = new URLSearchParams({gameId:entry.gameId,source,query:request.query,sort:'relevance',...filters});
      const result = await json('/v1/search?'+params) as SearchResult;
      statuses.push({query:request.query,status:result.status});
      for (const item of result.items) items.set(item.key,item);
    },new AbortController().signal);
    const expected = entry.projects.filter(project => project.source === source).map(project => project.id);
    const found = expected.filter(id => [...items.values()].some(item => item.id === id));
    const ranked = groupResults([...items.values()],query);
    const topCoverage = ranked.length ? keywordRelevance(ranked[0].listings[0],query).coverage : 0;
    const translated = requests.some(request => request.query === entry.term);
    const passed = translated && found.length === expected.length && topCoverage === 1 && statuses.every(({status}) => status === 'success' || status === 'empty');
    // Keep review evidence and counts, not cached provider result snapshots.
    const check = {gameId:entry.gameId,query,source,queries:requests.map(request => request.query),statuses,count:items.size,expectedIds:expected,foundIds:found,topCoverage,translated,passed};
    checks.push(check); console.log(JSON.stringify(check));
  }
}
const report = {base,localPlan,all,reviewedAt:review.reviewedAt,verifiedAt:new Date().toISOString(),passed:checks.every(check => check.passed),checks};
mkdirSync('output/deployment',{recursive:true});
writeFileSync(`output/deployment/trend-search-${localPlan?'local':'production'}.json`,JSON.stringify(report,null,2)+'\n');
assert.equal(report.passed,true,'Reviewed trend query or source-scoped project was not verified');
