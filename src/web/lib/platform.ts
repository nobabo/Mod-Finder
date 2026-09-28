import { safeExternalUrl } from '../../shared/links';
export const isNative = () => '__TAURI_INTERNALS__' in window;
export async function openExternal(value: string) {
  const url = safeExternalUrl(value);
  if (!url) throw new Error('허용되지 않은 링크예요.');
  if (isNative()) { const { openUrl } = await import('@tauri-apps/plugin-opener'); await openUrl(url); }
  else { const tab = window.open(url, '_blank', 'noopener,noreferrer'); void tab; }
}
