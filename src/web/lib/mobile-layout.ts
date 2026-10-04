import { useEffect, useState } from 'react';

// A narrow desktop window still uses the desktop layout.
export const MOBILE_LAYOUT_QUERY = '(hover: none) and (pointer: coarse)';

export function useMobileLayout() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_LAYOUT_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return mobile;
}
