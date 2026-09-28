export class UpstreamError extends Error {
  constructor(public code: 'timeout' | 'rate_limited' | 'auth' | 'invalid' | 'unavailable', public retryAfter = 0) { super(code); }
}
export function retrySeconds(value: string | null) {
  if (!value) return 60;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.min(86400, n)) : Math.max(1, Math.min(86400, Math.ceil((Date.parse(value) - Date.now()) / 1000) || 60));
}
export class UpstreamClient {
  private cooldown = new Map<string, number>();
  constructor(private userAgent: string, private fetcher: typeof fetch = (input, init) => fetch(input, init)) {}
  async json(url: string, init: RequestInit = {}, timeout = 4000): Promise<unknown> {
    const host = new URL(url).hostname;
    const until = this.cooldown.get(host) ?? 0;
    if (until > Date.now()) throw new UpstreamError('rate_limited', Math.ceil((until - Date.now()) / 1000));
    try {
      const response = await this.fetcher(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(timeout), headers: { Accept: 'application/json', 'User-Agent': this.userAgent, ...init.headers } });
      // Release rejected response bodies so failures cannot hold upstream connections open.
      if (!response.ok) await response.body?.cancel().catch(() => {});
      if (response.status === 429) {
        const delay = retrySeconds(response.headers.get('retry-after'));
        this.cooldown.set(host, Date.now() + delay * 1000); throw new UpstreamError('rate_limited', delay);
      }
      if (response.status === 401 || response.status === 403) throw new UpstreamError('auth');
      if (!response.ok) throw new UpstreamError('unavailable');
      if (response.headers.get('x-ratelimit-remaining') === '0') this.cooldown.set(host, Date.now() + retrySeconds(response.headers.get('x-ratelimit-reset')) * 1000);
      const reader = response.body?.getReader();
      if (!reader) throw new UpstreamError('invalid');
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          length += value.length;
          if (length > 4 * 1024 * 1024) { await reader.cancel(); throw new UpstreamError('invalid'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new UpstreamError('invalid'); }
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) throw new UpstreamError('timeout');
      throw new UpstreamError('unavailable');
    }
  }
}
