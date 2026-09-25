import { afterEach, describe, expect, it, vi } from 'vitest';
import { withRequestTimeout } from '../src/lib/request';
afterEach(() => vi.useRealTimers());
describe('browser request lifetime', () => {
  it('cancels a stalled request without AbortSignal.any or timeout', async () => {
    vi.useFakeTimers();
    const pending = withRequestTimeout(signal => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')))), undefined, 50);
    const assertion = expect(pending).rejects.toThrow('cancelled');
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('forwards parent cancellation and removes its listener', async () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    const removed = vi.spyOn(parent.signal, 'removeEventListener');
    const pending = withRequestTimeout(signal => new Promise(resolve => signal.addEventListener('abort', () => resolve('aborted'))), parent.signal);
    parent.abort();
    expect(await pending).toBe('aborted');
    expect(removed).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('handles an already cancelled parent and cleans successful requests', async () => {
    vi.useFakeTimers();
    const parent = new AbortController(); parent.abort();
    expect(await withRequestTimeout(async signal => signal.aborted, parent.signal)).toBe(true);
    expect(await withRequestTimeout(async () => 42)).toBe(42);
    expect(vi.getTimerCount()).toBe(0);
  });
});
