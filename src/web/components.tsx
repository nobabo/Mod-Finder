import { getGame } from '../shared/games';
import logos from '../shared/data/logos.json';
import { BrandLogo } from './BrandLogo';
import { ModDescription } from './ModDescription';
import { listingText, tagText } from '../shared/content';
import { t, locale } from './lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { Download, Users, Bookmark, FolderInput, Package, X } from 'lucide-react';
import type { Listing, Source } from '../shared/types';
export function SourceMark({ source }: { source: Source }) { return <span className={`source-mark ${source}`} aria-hidden="true">{{ modrinth: 'M', curseforge: 'C', thunderstore: 'T', nexus: 'N', steam: 'S' }[source]}</span>; }
export function ModIcon({ item }: { item: Listing }) {
  return <div className="mod-icon">{item.iconUrl ? <img src={item.iconUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }} /> : <Package size={30} />}</div>;
}
const numberFormatter = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
export const number = (n: number) => numberFormatter.format(n);
export const dateLabel = (date: string | null) => date ? new Date(date).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }) : t("정보 없음");

export function ModCard({ item, saved, toggleSave, open, detail, ready = true, move, saveAvailable = true }: { item: Listing; saved: boolean; toggleSave: () => void; open: () => void; detail: () => void; ready?: boolean; move?: () => void; saveAvailable?: boolean }) {
  const text = listingText(item, locale);
  return <ModDescription summary={text.summary}>
    <div className="card-cover"><button type="button" className="mod-logo-link" onClick={open} aria-label={`${text.title} ${t('원본 사이트에서 보기')}`}><ModIcon item={item} /></button>{saveAvailable && <button type="button" className={`icon-button save-button ${saved ? 'is-saved' : ''}`} disabled={!ready} onClick={toggleSave} aria-pressed={saved} aria-label={`${item.title} ${saved ? t("즐겨찾기 해제") : t("즐겨찾기")}`}><Bookmark size={18} fill={saved ? 'currentColor' : 'none'} /></button>}{move && <button type="button" className="icon-button move-favorite" aria-label={`${item.title} ${t('폴더로 이동')}`} title={t('폴더로 이동')} onClick={move}><FolderInput size={18}/></button>}</div>
    <div className="card-body">
      <button className="title-button" onClick={detail}>{text.title}</button>
      <p className="card-author">by {item.author ?? t("제작자 정보 없음")}</p>
      <div className="card-meta">{item.metrics[0] ? <span title={t(item.metrics[0].label)} aria-label={number(item.metrics[0].value) + ' ' + t(item.metrics[0].label)}>{item.metrics[0].label === '다운로드' ? <Download size={13}/> : <Users size={13}/>} {number(item.metrics[0].value)}</span> : <span>{t("통계 정보 없음")}</span>}</div>
      <div className="tags">{(item.loaders?.length ? item.loaders : item.tags).slice(0, 3).map(tag => <span key={tag}>{tagText(tag, locale)}</span>)}{!item.tags.length && !item.loaders?.length && <span>{item.kind ? tagText(item.kind, locale) : t("모드")}</span>}</div>
    </div>
  </ModDescription>;
}

function useDialog(close: () => void) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; (ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLButtonElement>('button'))?.focus(); return () => { document.body.style.overflow = overflow; previous?.focus(); }; }, []);
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') { const elements = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,[tabindex="0"]')]; const first = elements[0]; const last = elements.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
  };
  return { ref, onKeyDown };
}

export function Modal({ title, children, close, wide = false, hideTitle = false, className = '' }: { title: string; children: React.ReactNode; close: () => void; wide?: boolean; hideTitle?: boolean; className?: string }) {
  const { ref, onKeyDown } = useDialog(close);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section ref={ref} className={`modal ${wide ? 'wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKeyDown}><div className="modal-heading"><h2 className={hideTitle ? 'sr-only' : undefined}>{title}</h2><button className="icon-button" onClick={close} aria-label={t("닫기")}><X size={21} /></button></div>{children}</section></div>;
}

export function Sheet({ title, children, close }: { title: string; children: React.ReactNode; close: () => void }) {
  const { ref, onKeyDown } = useDialog(close);
  return <div className="sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKeyDown}><div className="sheet-heading"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label={t("닫기")}><X size={21} /></button></div>{children}</section></div>;
}

const MARKS: Record<string, React.ReactNode> = {
  all: <g fill="currentColor"><rect x="9" y="9" width="9" height="9" rx="2" /><rect x="22" y="9" width="9" height="9" rx="2" /><rect x="9" y="22" width="9" height="9" rx="2" /><rect x="22" y="22" width="9" height="9" rx="2" /></g>,
  'minecraft-java': <g><polygon points="20,5 35,13.5 20,22 5,13.5" fill="#8bc34a" /><polygon points="5,13.5 20,22 20,35 5,26.5" fill="#795548" /><polygon points="35,13.5 35,26.5 20,35 20,22" fill="#5d4037" /><polygon points="5,13.5 20,22 20,25 5,16.5" fill="#558b2f" /><polygon points="35,13.5 20,22 20,25 35,16.5" fill="#33691e" /></g>,
  'stardew-valley': <g><ellipse cx="17" cy="25" rx="11" ry="9" fill="#fff3d6" /><path d="M7 24c-4-2-4-9 1-10 3 2 4 6 2 9z" fill="#ffe0b2" /><circle cx="28" cy="15" r="6.5" fill="#fff3d6" /><polygon points="34,14.5 39,16 34,17.5" fill="#ffb300" /><circle cx="26" cy="9" r="2.4" fill="#e53935" /><circle cx="30" cy="8.4" r="2" fill="#e53935" /><circle cx="29.5" cy="14" r="1.2" fill="#37474f" /><rect x="14" y="32" width="2" height="5" fill="#ffb300" /><rect x="20" y="32" width="2" height="5" fill="#ffb300" /></g>,
  'skyrim-se': <g><path d="M8 31c-2-9 3-17 12-17 2-3 5-5 8-5l-2 5 6 2-5 3c1 3 0 6-2 8 3 3 3 7 1 10-4-2-7-3-11-2-4 1-6 0-7-4z" fill="#b0bec5" /><circle cx="24" cy="17" r="1.4" fill="#263238" /><polygon points="17,7 21,11 16,12" fill="#eceff1" /></g>,
  'lethal-company': <g><path d="M27 6a15 15 0 1 0 0 28 12 12 0 1 1 0-28z" fill="#ffb300" /><circle cx="31" cy="9" r="1.5" fill="#fff59d" /><circle cx="35" cy="18" r="1.1" fill="#fff59d" /></g>,
  rimworld: <g><circle cx="20" cy="19" r="9" fill="#7e57c2" /><ellipse cx="20" cy="20" rx="15" ry="4.6" fill="none" stroke="#b39ddb" strokeWidth="2.4" transform="rotate(-18 20 20)" /><circle cx="31" cy="8" r="1.4" fill="#e3f2fd" /></g>,
};
export function GameLogo({ gameId }: { gameId: string }) {
  const [failedSource, setFailedSource] = useState('');
  if (gameId === 'all') return <span className="game-logo"><BrandLogo /></span>;
  const game = getGame(gameId);
  const source = game?.image ?? (logos as Record<string, { src: string }>)[gameId]?.src;
  return <span className={`game-logo${game?.image ? '' : ' game-logo-wordmark'}`}>{source && failedSource !== source
    ? <img key={source} src={source} alt="" referrerPolicy="no-referrer" onError={() => setFailedSource(source)} />
    : <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#151230" />{MARKS[gameId] ?? <text x="20" y="25" textAnchor="middle" fontSize="14" fill="currentColor">{game?.short ?? '?'}</text>}</svg>}</span>;
}
