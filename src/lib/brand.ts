export const MF_PATH = 'M72 368V144H124L186 232L248 144H440V196H300V232H412V284H300V368H248V238L186 322L124 238V368H72Z';

export function updateBrandIcon(color: string) {
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!icon) return;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="${color}" d="${MF_PATH}"/></svg>`;
  icon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
