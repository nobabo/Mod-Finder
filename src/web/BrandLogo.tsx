import { useId } from 'react';
import { MF_PATH } from './lib/brand';
import { ArtworkReaction } from './ArtworkReaction';

export function BrandLogo({ size = 44 }: { size?: number }) {
  const gradient = useId();
  return <ArtworkReaction className="brand-art"><svg className="brand-logo" width={size} height={size} viewBox="0 0 512 512" fill="currentColor" aria-hidden="true" focusable="false"><defs><linearGradient id={gradient} x2="1" y2="1"><stop stopColor="var(--brand-start,var(--accent))"/><stop offset="1" stopColor="var(--brand-end,var(--cyan))"/></linearGradient></defs><path d={MF_PATH} fill={`url(#${gradient})`} /></svg></ArtworkReaction>;
}
