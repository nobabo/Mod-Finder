import { Check, RotateCcw } from 'lucide-react';
import { THEMES, defaultBackground } from './lib/themes';
import { locale, t } from './lib/i18n';
import { CardPages } from './CardPages';

export function ThemeOptions({ themeId, gameId, backgroundColor, changeTheme, changeBackground }: { themeId: string; gameId: string; backgroundColor?: string; changeTheme: (id: string) => void; changeBackground: (color?: string) => void }) {
  return <div className="theme-settings">
    <div className="theme-options"><CardPages columns={2}>{THEMES.map(theme => <button type="button" key={theme.id} aria-pressed={themeId === theme.id} onClick={() => changeTheme(theme.id)}>
      <i style={{ background: theme.grad }} />{locale === 'ko' ? theme.ko : theme.en}{themeId === theme.id && <Check size={14} />}
    </button>)}</CardPages></div>
    <div className="background-color-control">
      <label htmlFor="background-color">{t('배경색')}</label>
      <input id="background-color" type="color" value={backgroundColor ?? defaultBackground(themeId, gameId)} onChange={event => changeBackground(event.target.value)} />
      <button type="button" className="text-button" onClick={() => changeBackground(undefined)} disabled={!backgroundColor}><RotateCcw size={16}/>{t('기본 색상으로')}</button>
    </div>
  </div>;
}
