import type { Filters, FilterSelections } from './types';

export const MULTI_FILTER_KEYS = ['version', 'loader', 'kind'] as const;
export type MultiFilterKey = typeof MULTI_FILTER_KEYS[number];
export const filterValues = (value?: string | string[]): string[] => [...new Set((Array.isArray(value) ? value : value ? [value] : []).filter(Boolean))];

export function toggleFilter(filters: FilterSelections, key: MultiFilterKey, value: string): FilterSelections {
  const next = { ...filters };
  const current = filterValues(filters[key]);
  const values = value ? current.includes(value) ? current.filter(item => item !== value) : [...current, value] : [];
  if (values.length) next[key] = values.length === 1 ? values[0] : values;
  else delete next[key];
  return next;
}

// OR within each filter, AND across filters. Providers still receive one
// supported combination per request, each with its own pagination cursor.
export function filterCombinations(filters: FilterSelections): Filters[] {
  if (!MULTI_FILTER_KEYS.some(key => Array.isArray(filters[key]))) return [filters as Filters];
  let combinations: Filters[] = filters.category ? [{ category: filters.category }] : [{}];
  for (const key of MULTI_FILTER_KEYS) {
    const values = filterValues(filters[key]);
    if (values.length) combinations = combinations.flatMap(filter => values.map(value => ({ ...filter, [key]: value })));
  }
  return combinations;
}
