import { useState, type Dispatch, type SetStateAction } from 'react';
import { Bookmark, Check, Folder, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { Modal } from './components';
import { deleteFavoriteFolder, moveFavorite, setShortcutFolder, type LocalData } from './lib/storage';
import { t } from './lib/i18n';

type Update = Dispatch<SetStateAction<LocalData>>;
function ShortcutCheckbox({ checked, onChange, labelBelow = false }: { checked: boolean; onChange: (checked: boolean) => void; labelBelow?: boolean }) {
  return <label className="shortcut-toggle" title={t('메인 화면 바로가기')}>
    <span className="shortcut-checkbox-glass"><input type="checkbox" aria-label={t('메인 화면 바로가기')} checked={checked} onChange={event => onChange(event.target.checked)}/><Check size={labelBelow ? 21 : 16} aria-hidden="true"/></span>
    <span className={labelBelow ? 'shortcut-checkbox-label' : undefined}>{t('바로가기')}</span>
  </label>;
}

export function FolderBar({ data, update, selected, select }: { data: LocalData; update: Update; selected: string; select: (id: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const folder = data.folders.find(item => item.id === selected);
  const edit = (id: string, value: string) => { setEditing(id); setName(value); setShortcut(data.shortcutFolderId === id); setError(''); };
  return <>
    <div className="folder-toolbar">
      <nav className="folder-rail" aria-label={t('즐겨찾기 그룹')}>
        {[{ id: 'all', name: t('전체'), Icon: Bookmark }, ...data.folders.map(item => ({ ...item, Icon: Folder }))].map(item =>
          <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => select(item.id)}><item.Icon size={18}/><span>{item.name}</span>{data.shortcutFolderId === item.id && <Check size={16} aria-label={t('메인 화면 바로가기')}/>}</button>)}
      </nav>
      <div className="folder-actions">
        {folder && <ShortcutCheckbox checked={data.shortcutFolderId === folder.id} onChange={checked => update(previous => setShortcutFolder(previous, folder.id, checked))}/>}
        <button type="button" className="icon-button" aria-label={t('새 그룹')} title={t('새 그룹')} onClick={() => edit('', '')}><FolderPlus size={20}/></button>
        {folder && <><button type="button" className="icon-button" aria-label={t('그룹 편집')} title={t('그룹 편집')} onClick={() => edit(folder.id, folder.name)}><Pencil size={18}/></button><button type="button" className="icon-button" aria-label={t('그룹 삭제')} title={t('그룹 삭제')} onClick={() => { update(previous => deleteFavoriteFolder(previous, folder.id)); select('all'); }}><Trash2 size={18}/></button></>}
      </div>
    </div>
    {editing !== null && <Modal className="folder-modal" hideTitle title={t(editing ? '그룹 편집' : '새 그룹')} close={() => setEditing(null)}>
      <form className="folder-form" onSubmit={event => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) { setError(t('그룹명을 입력하세요.')); return; }
        if (data.folders.some(item => item.id !== editing && item.name.normalize('NFKC').toLowerCase() === trimmed.normalize('NFKC').toLowerCase())) { setError(t('같은 이름의 그룹이 있어요.')); return; }
        const id = editing || `folder-${crypto.randomUUID()}`;
        update(previous => setShortcutFolder({ ...previous, folders: editing ? previous.folders.map(item => item.id === editing ? { ...item, name: trimmed } : item) : [...previous.folders, { id, name: trimmed, keys: [] }] }, id, shortcut));
        select(id); setEditing(null);
      }}>
        <div className="folder-form-row">
          <ShortcutCheckbox labelBelow checked={shortcut} onChange={setShortcut}/>
          <div className="folder-input-glass"><input id="folder-name" aria-label={t('그룹명')} placeholder={t('그룹명')} aria-invalid={!!error} aria-describedby={error ? 'folder-error' : undefined} data-autofocus maxLength={40} value={name} onChange={event => { setName(event.target.value); setError(''); }} /></div>
          <button type="submit" className="icon-button folder-save" aria-label={t('저장')} title={t('저장')}><Check size={21} aria-hidden="true"/></button>
        </div>
        {error && <p id="folder-error" role="alert">{error}</p>}
      </form>
    </Modal>}
  </>;
}

export function MoveFavorite({ itemKey, data, update, close }: { itemKey: string; data: LocalData; update: Update; close: () => void }) {
  const current = data.folders.find(folder => folder.keys.includes(itemKey))?.id ?? null;
  return <Modal title={t('그룹으로 이동')} close={close}><div className="folder-destinations">
    {[{ id: null, name: t('전체') }, ...data.folders].map(folder => <button type="button" key={folder.id ?? 'all'} aria-pressed={current === folder.id} onClick={() => { update(previous => moveFavorite(previous, itemKey, folder.id)); close(); }}><Folder size={20}/><span>{folder.name}</span>{current === folder.id && <Check size={18}/>}</button>)}
  </div></Modal>;
}
