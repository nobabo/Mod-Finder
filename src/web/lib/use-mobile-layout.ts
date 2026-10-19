import { useEffect, useState } from 'react';
import { isNative } from './platform';

export function useMobileLayout(query = '(max-width: 850px)') {
  const [mobile, setMobile] = useState(() => !isNative() && window.matchMedia(query).matches);
  useEffect(() => {
    if (isNative()) return;
    const media = window.matchMedia(query);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return mobile;
}
