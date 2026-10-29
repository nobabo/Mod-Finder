import { Check } from 'lucide-react';
import { defaultBackground } from './lib/themes';
import { t } from './lib/i18n';
import { CardPages } from './CardPages';
import { useState } from 'react';
import { ColorPicker } from './ColorPicker';
import { colorCss, parseBackgroundColor } from './lib/background-color';

export function ThemeOptions({ themeId, gameId, backgroundColor, changeTheme, changeBackground }: { themeId: string; gameId: string; backgroundColor?: string; changeTheme: (id: string) => void; changeBackground: (color?: string) => void }) {
  const [pickerOpen,setPickerOpen] = useState(false);
  const color = backgroundColor ?? defaultBackground(themeId,gameId);
  return <div className="theme-settings">
    <div className="theme-options"><CardPages columns={2}>
      <button type="button" aria-pressed={!backgroundColor} onClick={() => { changeTheme('game'); changeBackground(undefined); setPickerOpen(false); }}>
        <i style={{ background:'var(--grad)' }}/>{t('기본 색상')}{!backgroundColor && <Check size={14}/>}
      </button>
      <button type="button" aria-pressed={!!backgroundColor} aria-haspopup="dialog" aria-expanded={pickerOpen} onClick={() => setPickerOpen(true)}>
        <i className="theme-custom-swatch color-checker"><span style={{ background:colorCss(parseBackgroundColor(color)) }}/></i>{t('커스텀 색상')}{backgroundColor && <Check size={14}/>}
      </button>
    </CardPages></div>
    {pickerOpen && <ColorPicker value={color} change={value => { changeTheme('game'); changeBackground(value); }} close={() => setPickerOpen(false)}/>}
  </div>;
}
