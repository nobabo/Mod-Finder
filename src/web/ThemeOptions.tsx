import { Check, RotateCcw } from 'lucide-react';
import { THEMES, defaultBackground } from './lib/themes';
import { locale, t } from './lib/i18n';
import { CardPages } from './CardPages';
import { useState } from 'react';
import { ColorPicker } from './ColorPicker';
import { colorCss, parseBackgroundColor } from './lib/background-color';

export function ThemeOptions({ themeId, gameId, backgroundColor, changeTheme, changeBackground }: { themeId: string; gameId: string; backgroundColor?: string; changeTheme: (id: string) => void; changeBackground: (color?: string) => void }) {
  const [pickerOpen,setPickerOpen] = useState(false);
  const color = backgroundColor ?? defaultBackground(themeId,gameId);
  return <div className="theme-settings">
    <div className="theme-options"><CardPages columns={2}>{THEMES.map(theme => <button type="button" key={theme.id} aria-pressed={themeId === theme.id} onClick={() => changeTheme(theme.id)}>
      <i style={{ background: theme.grad }} />{locale === 'ko' ? theme.ko : theme.en}{themeId === theme.id && <Check size={14} />}
    </button>)}</CardPages></div>
    <div className="background-color-control">
      <span className="background-color-label">{t('배경색')}</span>
      <button id="background-color" type="button" className="color-swatch color-checker" aria-label={t('색상 선택')} aria-haspopup="dialog" aria-expanded={pickerOpen} onClick={() => setPickerOpen(true)}><span style={{ background:colorCss(parseBackgroundColor(color)) }}/></button>
      <button type="button" className="text-button" onClick={() => changeBackground(undefined)} disabled={!backgroundColor}><RotateCcw size={16}/>{t('기본 색상으로')}</button>
    </div>
    {pickerOpen && <ColorPicker value={color} change={changeBackground} close={() => setPickerOpen(false)}/>}
  </div>;
}
