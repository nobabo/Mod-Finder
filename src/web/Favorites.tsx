import { useState, type Dispatch, type SetStateAction } from 'react';
import { Bookmark, Check, Folder, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { Modal } from './components';
import { deleteFavoriteFolder, moveFavorite, setShortcutFolder, type LocalData } from './lib/storage';
import { t } from './lib/i18n';

type Update = Dispatch<SetStateAction<LocalData>>;
export function FolderBar({ data, update, selected, select, mobileLayout }: { data: LocalData; update: Update; selected: string; select: (id: string) => void; mobileLayout: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const folder = data.folders.find(item => item.id === selected);
  const edit = (id: string, value: string) => { setEditing(id); setName(value); setShortcut(data.shortcutFolderId === id); setError(''); };
  return <>
    <div className="folder-toolbar">
      <nav className="folder-rail" aria-label={t('즐겨찾기 그룹')}>
        {[{ id: 'all', name: t('전체'), Icon: Bookmark }, ...(mobileLayout ? [] : [{ id: 'unfiled', name: t('미분류'), Icon: Folder }]), ...data.folders.map(item => ({ ...item, Icon: Folder }))].map(item =>
          <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => select(item.id)}><item.Icon size={18}/><span>{item.name}</span>{data.shortcutFolderId === item.id && <Check size={16} aria-label={t('메인 화면 바로가기')}/>}</button>)}
      </nav>
      <div className="folder-actions">
        <button type="button" className="icon-button" aria-label={t('새 그룹')} title={t('새 그룹')} onClick={() => edit('', '')}><FolderPlus size={20}/></button>
        {folder && <><label className="shortcut-toggle"><input type="checkbox" aria-label={t('메인 화면 바로가기')} checked={data.shortcutFolderId === folder.id} onChange={event => { const checked = event.target.checked; update(previous => setShortcutFolder(previous, folder.id, checked)); }}/><span>{t('바로가기')}</span></label><button type="button" className="icon-button" aria-label={t('그룹 편집')} title={t('그룹 편집')} onClick={() => edit(folder.id, folder.name)}><Pencil size={18}/></button><button type="button" className="icon-button" aria-label={t('그룹 삭제')} title={t(mobileLayout ? '그룹 삭제' : '그룹 삭제 · 모드는 미분류로 이동')} onClick={() => { update(previous => deleteFavoriteFolder(previous, folder.id)); select(mobileLayout ? 'all' : 'unfiled'); }}><Trash2 size={18}/></button></>}
      </div>
    </div>
    {editing !== null && <Modal className="folder-modal" hideTitle={!editing} title={t(editing ? '그룹 편집' : '새 그룹')} close={() => setEditing(null)}>
      <form className="folder-form" onSubmit={event => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) { setError(t('그룹명을 입력하세요.')); return; }
        if (data.folders.some(item => item.id !== editing && item.name.normalize('NFKC').toLowerCase() === trimmed.normalize('NFKC').toLowerCase())) { setError(t('같은 이름의 그룹이 있어요.')); return; }
        const id = editing || `folder-${crypto.randomUUID()}`;
        update(previous => setShortcutFolder({ ...previous, folders: editing ? previous.folders.map(item => item.id === editing ? { ...item, name: trimmed } : item) : [...previous.folders, { id, name: trimmed, keys: [] }] }, id, shortcut));
        select(id); setEditing(null);
      }}>
        <label htmlFor="folder-name">{t('그룹명')}</label>
        <div className="folder-input-glass"><input id="folder-name" data-autofocus maxLength={40} value={name} onChange={event => { setName(event.target.value); setError(''); }} /></div>
        <label className="shortcut-toggle"><input type="checkbox" checked={shortcut} onChange={event => setShortcut(event.target.checked)}/><span>{t('메인 화면 바로가기')}</span></label>
        {error && <p role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>{t('취소')}</button><button type="submit" className="primary-button">{t('저장')}</button></div>
      </form>
    </Modal>}
  </>;
}

export function MoveFavorite({ itemKey, data, update, close }: { itemKey: string; data: LocalData; update: Update; close: () => void }) {
  const current = data.folders.find(folder => folder.keys.includes(itemKey))?.id ?? null;
  return <Modal title={t('그룹으로 이동')} close={close}><div className="folder-destinations">
    {[{ id: null, name: t('미분류') }, ...data.folders].map(folder => <button type="button" key={folder.id ?? 'unfiled'} aria-pressed={current === folder.id} onClick={() => { update(previous => moveFavorite(previous, itemKey, folder.id)); close(); }}><Folder size={20}/><span>{folder.name}</span>{current === folder.id && <Check size={18}/>}</button>)}
  </div></Modal>;
}
