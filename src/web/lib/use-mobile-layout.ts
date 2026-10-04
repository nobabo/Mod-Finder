import { useEffect, useState } from 'react';

export function useMobileLayout() {
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 850px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width: 850px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return mobile;
}
