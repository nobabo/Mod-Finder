import { APP_DOWNLOADS, APP_RELEASE } from '../shared/app-downloads';

export async function downloadInstaller(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname;
  const artifact = path === '/downloads/windows' ? APP_DOWNLOADS.windows
    : path === '/downloads/android' ? APP_DOWNLOADS.android : null;
  if (!artifact) return new Response('Not found', { status: 404 });
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  // Only fixed public release files are reachable. Never forward cookies or credentials.
  const url = new URL(`https://github.com/nobabo/Mod-Finder/releases/download/${APP_RELEASE}/${artifact.fileName}`);
  url.searchParams.set('sha256', artifact.sha256);
  const headers = new Headers({ Accept: 'application/octet-stream', 'Accept-Encoding': 'identity', 'User-Agent': 'ModFinder-Downloads' });
  for (const name of ['Range', 'If-Range']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(url, { method: request.method, headers, redirect: 'follow' });
    if (upstream.status === 416) {
      await upstream.body?.cancel();
      const rangeHeaders = new Headers({ 'Cache-Control': 'no-store' });
      const range = upstream.headers.get('Content-Range');
      if (range) rangeHeaders.set('Content-Range', range);
      return new Response(null, { status: 416, headers: rangeHeaders });
    }
    const type = upstream.headers.get('Content-Type')?.split(';')[0].trim();
    if (![200, 206].includes(upstream.status) || !['application/octet-stream', artifact.contentType, 'application/x-msdownload'].includes(type ?? '')) {
      await upstream.body?.cancel();
      throw new Error('Release file unavailable');
    }
    const downloadHeaders = new Headers({
      'Content-Type': artifact.contentType,
      'Content-Disposition': `attachment; filename="${artifact.fileName}"`,
      'Cache-Control': 'public, max-age=300',
      'X-Checksum-SHA256': artifact.sha256,
    });
    for (const name of ['Content-Length', 'Content-Range', 'Content-Encoding', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
      const value = upstream.headers.get(name);
      if (value) downloadHeaders.set(name, value);
    }
    return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers: downloadHeaders });
  } catch {
    return new Response(request.method === 'HEAD' ? null : 'Download temporarily unavailable. Please try again.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '60' },
    });
  }
}
