// AbortSignal.any/timeout are newer than our supported browser targets.
// Always release the timer and parent listener, including after body parsing.
export async function withRequestTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal, milliseconds = 5000): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parent?.aborted) abort();
  else parent?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, milliseconds);
  try { return await operation(controller.signal); }
  finally { clearTimeout(timer); parent?.removeEventListener('abort', abort); }
}
