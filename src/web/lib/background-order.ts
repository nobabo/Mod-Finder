/** A complete shuffled round, with no immediate repeat at a round boundary. */
export function shuffleBackgrounds<T extends { src: string }>(photos: readonly T[], previous?: string, random = Math.random): T[] {
  const order = [...photos];
  for (let index = order.length - 1; index > 0; index--) {
    const other = Math.min(index, Math.floor(random() * (index + 1)));
    [order[index], order[other]] = [order[other], order[index]];
  }
  if (order.length > 1 && order[0].src === previous) {
    const other = 1 + Math.min(order.length - 2, Math.floor(random() * (order.length - 1)));
    [order[0], order[other]] = [order[other], order[0]];
  }
  return order;
}

export function lastBackground(scope: string): string | undefined {
  try { return sessionStorage.getItem(`modfinder-background:${scope}`) ?? undefined; }
  catch { return undefined; }
}

export function rememberBackground(scope: string, src: string) {
  try { sessionStorage.setItem(`modfinder-background:${scope}`, src); }
  catch { /* Backgrounds also work when optional storage is unavailable. */ }
}
