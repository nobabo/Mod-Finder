import { useEffect, useId, useState, type ReactNode } from 'react';
import { MF_PATH } from './lib/brand';
import './entry-intro.css';

const SEEN_KEY = 'modfinder-intro-seen';
let seenThisSession = false;

function shouldShowIntro() {
  if (seenThisSession || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try { return localStorage.getItem(SEEN_KEY) !== '1'; }
  catch { return true; }
}

// Paint expands from this diagonal, then opens in two halves.
const seam = 'M1100 -100 L1000 0 C950 75 875 65 865 135 C855 205 745 180 735 265 C725 340 635 315 605 395 C575 475 520 425 500 500 C480 575 395 550 370 630 C345 710 255 670 235 765 C215 850 115 815 100 900 C85 955 35 950 0 1000 L-100 1100';

export function EntryIntro({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(shouldShowIntro);
  const paintMask = useId();

  useEffect(() => {
    seenThisSession = true;
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* Continue when storage is unavailable. */ }
    if (!active) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => setActive(false);
    const onMotionChange = () => { if (reducedMotion.matches) finish(); };
    reducedMotion.addEventListener('change', onMotionChange);
    // Also release the screen if animation events are interrupted by a WebView.
    const timeout = window.setTimeout(finish, 3800);
    return () => {
      window.clearTimeout(timeout);
      reducedMotion.removeEventListener('change', onMotionChange);
    };
  }, [active]);

  return <>
    <div className="entry-content" inert={active}>{children}</div>
    {active && <div className="entry-intro" aria-hidden="true" onAnimationEnd={event => {
      if (event.animationName === 'entry-intro-dismiss') setActive(false);
    }}>
      <div className="entry-intro-black" />
      <svg className="entry-intro-curtain" viewBox="0 0 1000 1000" preserveAspectRatio="none" focusable="false">
        <defs><mask id={paintMask} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
          <path className="entry-intro-spread" d={seam} fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
        </mask></defs>
        <g mask={`url(#${paintMask})`}>
          {(['left', 'right'] as const).map(side => <g key={side} className={`entry-intro-paint entry-intro-${side}`}>
            <path d={`${seam} H${side === 'left' ? -1800 : 2800} V-100 Z`} fill="#f564a1" stroke="#f564a1" strokeWidth="2" />
            <path className="entry-intro-paint-edge" d={seam} fill="none" stroke="#ff9dbe" strokeWidth="18" />
          </g>)}
        </g>
        <path className="entry-intro-seam" d="M0 1000 L1000 0" fill="none" stroke="#f564a1" strokeWidth="3" pathLength="1" />
      </svg>
      <svg className="entry-intro-logo" viewBox="0 0 512 512" fill="#f564a1" focusable="false"><path d={MF_PATH} /></svg>
    </div>}
  </>;
}
