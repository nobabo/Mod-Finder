import { useMobileLayout as useResponsiveMobileLayout } from './use-mobile-layout';

// Match the web header breakpoint; native windows always keep the desktop layout.
export const MOBILE_LAYOUT_QUERY = '(max-width: 1400px)';

export function useMobileLayout() {
  return useResponsiveMobileLayout(MOBILE_LAYOUT_QUERY);
}
