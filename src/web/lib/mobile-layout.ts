import { useEffect, useState } from 'react';

// Match the responsive mobile styles regardless of the input device.
export const MOBILE_LAYOUT_QUERY = '(max-width: 1400px)';

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
