import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { colorCss, colorHex, hsvToRgb, normalizeBackgroundColor, parseBackgroundColor, rgbToHsv, type HsvColor, type RgbaColor } from './lib/background-color';
import { useOverlay } from './lib/overlay';
import { t } from './lib/i18n';

export function ColorPicker({ value, change, close }: { value: string; change: (color: string) => void; close: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const title = useId();
  const rgba = parseBackgroundColor(value);
  const [hsv, setHsv] = useState(() => rgbToHsv(rgba));
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  useOverlay(root);
  const updateHsv = (next: HsvColor) => { setHsv(next); change(colorHex(hsvToRgb(next,rgba.a))); };
  const updateRgb = (next: RgbaColor) => {
    const converted = rgbToHsv(next);
    setHsv({ ...converted, h: converted.s === 0 || converted.v === 0 ? hsv.h : converted.h });
    change(colorHex(next));
  };
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    updateHsv({ ...hsv, s: Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)), v: 1-Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height)) });
  };
  return createPortal(<div className="color-picker-backdrop" onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) close(); }}>
    <div ref={root} className="color-picker-dialog" role="dialog" aria-modal="true" aria-labelledby={title} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close(); } }}>
      <div className="color-picker">
        <header><h2 id={title}>{t('배경색')}</h2><button type="button" className="deck-close" aria-label={t('닫기')} onClick={close}><X size={20}/></button></header>
        <div className="color-picker-sv" role="slider" tabIndex={0} data-autofocus aria-label={t('채도와 명도')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.s*100)} aria-valuetext={`${Math.round(hsv.s*100)}%, ${Math.round(hsv.v*100)}%`}
          style={{ backgroundColor:`hsl(${hsv.h},100%,50%)` }}
          onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; event.preventDefault(); event.currentTarget.focus({ preventScroll:true }); event.currentTarget.setPointerCapture(event.pointerId); point(event); }}
          onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) point(event); }}
          onKeyDown={event => {
            const step = event.shiftKey ? .1 : .01;
            if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
            event.preventDefault();
            updateHsv({ ...hsv, s: event.key === 'Home' ? 0 : event.key === 'End' ? 1 : Math.max(0,Math.min(1,hsv.s + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0))), v: Math.max(0,Math.min(1,hsv.v + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0))) });
          }}>
          <span className="color-picker-cursor" style={{ left:`${hsv.s*100}%`, top:`${(1-hsv.v)*100}%`, background:colorCss({...rgba,a:1}) }}/>
        </div>
        <label className="color-picker-slider"><span>{t('색조')}</span><input type="range" className="color-picker-hue" min="0" max="360" step="1" value={hsv.h} onChange={event => updateHsv({...hsv,h:Number(event.target.value)})}/></label>
        <label className="color-picker-slider"><span>{t('불투명도')}</span><span className="color-checker color-picker-alpha-track"><input type="range" min="0" max="1" step=".01" value={rgba.a} onChange={event => change(colorHex({...rgba,a:Number(event.target.value)}))} style={{ background:`linear-gradient(90deg,transparent,${colorCss({...rgba,a:1})})` }}/></span></label>
        <div className="color-picker-fields">{(['r','g','b','a'] as const).map(channel => <label key={channel}><span>{channel.toUpperCase()}</span><input aria-label={channel.toUpperCase()} type="number" inputMode={channel === 'a' ? 'decimal' : 'numeric'} min="0" max={channel === 'a' ? 1 : 255} step={channel === 'a' ? '.01' : 1} value={channel === 'a' ? Number(rgba.a.toFixed(2)) : rgba[channel]} onChange={event => {
          if (!event.target.value || !event.target.validity.valid) return;
          const next = {...rgba,[channel]:Number(event.target.value)};
          if (channel === 'a') change(colorHex(next)); else updateRgb(next);
        }}/></label>)}</div>
        <div className="color-picker-hex-row"><span className="color-checker color-picker-preview"><span style={{ background:colorCss(rgba) }}/></span><label><span>HEX</span><input type="text" aria-label="HEX" spellCheck={false} maxLength={9} value={hex} onChange={event => { const next = event.target.value; setHex(next); if (normalizeBackgroundColor(next)) updateRgb(parseBackgroundColor(next)); }} onBlur={() => setHex(value)}/></label></div>
      </div>
    </div>
  </div>,document.body);
}
