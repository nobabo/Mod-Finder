import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadInstaller } from '../../src/worker/downloads';
import { APP_DOWNLOADS } from '../../src/shared/app-downloads';

afterEach(() => vi.unstubAllGlobals());
describe('installer downloads', () => {
  it.each(['windows', 'android'] as const)('streams %s as an attachment without forwarding credentials', async platform => {
    const upstream = new Response('binary fixture', { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': '14' } });
    const fetchFile = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal('fetch', fetchFile);
    const response = await downloadInstaller(new Request(`https://modfinder.pages.dev/downloads/${platform}?url=https://untrusted.example`, {
      headers: { Cookie: 'private=value', Authorization: 'Bearer private' },
    }));
    expect(response.status).toBe(200);
    expect(response.body).toBe(upstream.body);
    expect(response.headers.get('Content-Disposition')).toBe(`attachment; filename="${APP_DOWNLOADS[platform].fileName}"`);
    expect(response.headers.get('X-Checksum-SHA256')).toBe(APP_DOWNLOADS[platform].sha256);
    expect(response.headers.get('Content-Length')).toBe('14');
    const [url, options] = fetchFile.mock.calls[0];
    expect(url.origin).toBe('https://github.com');
    expect(url.pathname).toContain(`/releases/download/v0.1.0/${APP_DOWNLOADS[platform].fileName}`);
    expect(options.headers.has('Cookie')).toBe(false);
    expect(options.headers.has('Authorization')).toBe(false);
    expect(await response.text()).toBe('binary fixture');
  });
  it('forwards a resumed download and preserves its partial response', async () => {
    const fetchFile = vi.fn().mockResolvedValue(new Response('part', { status: 206, headers: {
      'Content-Type': 'application/octet-stream', 'Content-Range': 'bytes 5-8/20', 'Content-Length': '4', 'Accept-Ranges': 'bytes', ETag: '"version"',
    } }));
    vi.stubGlobal('fetch', fetchFile);
    const response = await downloadInstaller(new Request('https://modfinder.pages.dev/downloads/windows', { headers: { Range: 'bytes=5-8', 'If-Range': '"version"' } }));
    expect(fetchFile.mock.calls[0][1].headers.get('Range')).toBe('bytes=5-8');
    expect(fetchFile.mock.calls[0][1].headers.get('If-Range')).toBe('"version"');
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 5-8/20');
    expect(await response.text()).toBe('part');
  });
  it('supports HEAD without downloading the body', async () => {
    const fetchFile = vi.fn().mockResolvedValue(new Response(null, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': '42' } }));
    vi.stubGlobal('fetch', fetchFile);
    const response = await downloadInstaller(new Request('https://modfinder.pages.dev/downloads/android', { method: 'HEAD' }));
    expect(fetchFile.mock.calls[0][1].method).toBe('HEAD');
    expect(response.headers.get('Content-Length')).toBe('42');
    expect(await response.text()).toBe('');
  });
  it('preserves an unsatisfiable range', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('out of range', { status: 416, headers: { 'Content-Range': 'bytes */20' } })));
    const response = await downloadInstaller(new Request('https://modfinder.pages.dev/downloads/android', { headers: { Range: 'bytes=999-' } }));
    expect(response.status).toBe(416);
    expect(response.headers.get('Content-Range')).toBe('bytes */20');
    expect(await response.text()).toBe('');
  });
  it('does not save an upstream error page as an installer', async () => {
    for (const status of [200, 404, 500]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Error</html>', { status, headers: { 'Content-Type': 'text/html' } })));
      const response = await downloadInstaller(new Request('https://modfinder.pages.dev/downloads/windows'));
      expect(response.status).toBe(503);
      expect(response.headers.has('Content-Disposition')).toBe(false);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  });
  it('handles a network failure without exposing its details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private error details')));
    const response = await downloadInstaller(new Request('https://modfinder.pages.dev/downloads/windows'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private error details');
  });
  it('rejects unknown files and unsupported methods before fetching', async () => {
    const fetchFile = vi.fn();
    vi.stubGlobal('fetch', fetchFile);
    expect((await downloadInstaller(new Request('https://modfinder.pages.dev/downloads/arbitrary'))).status).toBe(404);
    const response = await downloadInstaller(new Request('https://modfinder.pages.dev/downloads/windows', { method: 'POST' }));
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
    expect(fetchFile).not.toHaveBeenCalled();
  });
});
