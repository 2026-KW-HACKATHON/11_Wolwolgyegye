import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { SUB_CATEGORIES } from '../../core/categories/subCategories';
import { MENU_KIND_LABELS, type MenuKind } from '../../core/source/storeDetail';
import type { HoursRow } from '../../core/utils/hours';
import { useToast } from '../../shared/toast/ToastContext';
import {
  deleteMenu, fetchOwnerStoreInfo, saveMenu, saveStoreBasics, saveStoreHours, validateHours, validateMenu,
  type MenuInput, type OwnerMenu, type OwnerStoreBasics, type OwnerStoreInfo,
} from './ownerApi';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
/** 월요일부터 보여준다 */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const errorText = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

/** 사장님 화면 > 가게 정보: 기본 정보 · 영업시간 · 메뉴를 각각 저장한다 */
export default function OwnerInfoPanel({ storeId, onRenamed }: { storeId: string; onRenamed?: () => void }) {
  const [info, setInfo] = useState<OwnerStoreInfo | null>(null);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    try { setInfo(await fetchOwnerStoreInfo(storeId)); setLoadError(''); }
    catch (e) { setLoadError(errorText(e, '가게 정보를 불러오지 못했어요.')); }
  }, [storeId]);
  useEffect(() => { setInfo(null); void reload(); }, [reload]);

  if (loadError) return <p className="op-error" role="alert">{loadError}</p>;
  if (!info) return <p className="op-muted">불러오는 중…</p>;
  return (
    <div className="op-panel">
      <BasicsForm key={`basics-${storeId}`} storeId={storeId} initial={info.basics} onSaved={onRenamed} />
      <HoursForm key={`hours-${storeId}`} storeId={storeId} initial={info.hours} />
      <MenuEditor storeId={storeId} menus={info.menus} onChanged={reload} />
    </div>
  );
}

function BasicsForm({ storeId, initial, onSaved }: { storeId: string; initial: OwnerStoreBasics; onSaved?: () => void }) {
  const showToast = useToast();
  const [basics, setBasics] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { await saveStoreBasics(storeId, basics); showToast('가게 정보를 저장했어요'); onSaved?.(); }
    catch (cause) { setError(errorText(cause, '저장하지 못했어요.')); }
    finally { setBusy(false); }
  }

  return (
    <form className="op-panel-section op-form" onSubmit={submit}>
      <h3>기본 정보</h3>
      <label>가게 이름<input required maxLength={100} value={basics.name} onChange={(e) => setBasics({ ...basics, name: e.target.value })} /></label>
      <div className="op-form-grid">
        <label>대표 유형
          <select value={basics.typeId ?? ''} onChange={(e) => setBasics({ ...basics, typeId: e.target.value || null })}>
            <option value="">선택 안 함</option>
            {SUB_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label>전화번호<input type="tel" maxLength={25} value={basics.phone} onChange={(e) => setBasics({ ...basics, phone: e.target.value })} placeholder="02-000-0000" /></label>
      </div>
      <label>업종 설명<input maxLength={100} value={basics.industry} onChange={(e) => setBasics({ ...basics, industry: e.target.value })} placeholder="한식 · 백반/한정식" /></label>
      {error && <p className="op-error" role="alert">{error}</p>}
      <button type="submit" className="op-primary" disabled={busy}>{busy ? '저장 중…' : '기본 정보 저장'}</button>
    </form>
  );
}

function HoursForm({ storeId, initial }: { storeId: string; initial: HoursRow[] }) {
  const showToast = useToast();
  const [hours, setHours] = useState(() => initial.map((h) => ({ ...h, opens_at: h.opens_at?.slice(0, 5) ?? null, closes_at: h.closes_at?.slice(0, 5) ?? null })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (weekday: number, patch: Partial<HoursRow>) => setHours((list) => list.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const problem = validateHours(hours);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try { await saveStoreHours(storeId, hours); showToast('영업시간을 저장했어요'); }
    catch (cause) { setError(errorText(cause, '저장하지 못했어요.')); }
    finally { setBusy(false); }
  }

  return (
    <form className="op-panel-section op-form" onSubmit={submit}>
      <h3>영업시간</h3>
      <p className="op-muted">자정을 넘겨 닫으면 닫는 시각을 여는 시각보다 이르게 적어 주세요.</p>
      <ul className="op-hours">
        {WEEK_ORDER.map((day) => {
          const h = hours.find((row) => row.weekday === day)!;
          return (
            <li key={day} className={h.is_closed ? 'is-closed' : undefined}>
              <b>{DAY_LABELS[day]}</b>
              <input type="time" aria-label={`${DAY_LABELS[day]}요일 여는 시각`} disabled={h.is_closed} value={h.opens_at ?? ''} onChange={(e) => update(day, { opens_at: e.target.value || null })} />
              <span aria-hidden="true">~</span>
              <input type="time" aria-label={`${DAY_LABELS[day]}요일 닫는 시각`} disabled={h.is_closed} value={h.closes_at ?? ''} onChange={(e) => update(day, { closes_at: e.target.value || null })} />
              <label className="op-check"><input type="checkbox" checked={h.is_closed} onChange={(e) => update(day, { is_closed: e.target.checked })} />휴무</label>
            </li>
          );
        })}
      </ul>
      {error && <p className="op-error" role="alert">{error}</p>}
      <button type="submit" className="op-primary" disabled={busy}>{busy ? '저장 중…' : '영업시간 저장'}</button>
    </form>
  );
}

const EMPTY_MENU: MenuInput = { name: '', price: 0, section: '', kind: null, description: '', sortOrder: 0 };

function MenuEditor({ storeId, menus, onChanged }: { storeId: string; menus: OwnerMenu[]; onChanged: () => Promise<void> }) {
  const showToast = useToast();
  /** 수정 중인 메뉴 id. 'new' = 새 메뉴 추가 */
  const [editing, setEditing] = useState<string | null>(null);
  const nextOrder = menus.reduce((max, m) => Math.max(max, m.sortOrder), 0) + 1;

  async function remove(menu: OwnerMenu) {
    try { await deleteMenu(menu.id); showToast('메뉴를 삭제했어요'); await onChanged(); }
    catch (cause) { showToast(errorText(cause, '삭제하지 못했어요.')); }
  }
  async function saved() { setEditing(null); showToast('메뉴를 저장했어요'); await onChanged(); }

  return (
    <section className="op-panel-section" aria-label="메뉴">
      <h3>메뉴 <span className="op-muted">{menus.length}개</span></h3>
      {menus.length === 0 && editing !== 'new' && <p className="op-muted">등록된 메뉴가 없어요.</p>}
      <ul className="op-list">
        {menus.map((menu) => editing === menu.id
          ? <li key={menu.id}><MenuForm storeId={storeId} id={menu.id} initial={menu} onSaved={saved} onCancel={() => setEditing(null)} /></li>
          : (
            <li key={menu.id} className="op-list-row">
              <div>
                <strong>{menu.name}</strong>
                <span className="op-muted">{won(menu.price)}{menu.section ? ` · ${menu.section}` : menu.kind ? ` · ${MENU_KIND_LABELS[menu.kind]}` : ''}</span>
                {menu.description && <span className="op-muted">{menu.description}</span>}
              </div>
              <span className="op-row-actions">
                <button type="button" className="op-text-btn" onClick={() => setEditing(menu.id)}>수정</button>
                <button type="button" className="op-text-btn is-danger" onClick={() => void remove(menu)}>삭제</button>
              </span>
            </li>
          ))}
      </ul>
      {editing === 'new'
        ? <MenuForm storeId={storeId} initial={{ ...EMPTY_MENU, sortOrder: nextOrder }} onSaved={saved} onCancel={() => setEditing(null)} />
        : <button type="button" className="op-secondary" onClick={() => setEditing('new')}>＋ 메뉴 추가</button>}
    </section>
  );
}

function MenuForm({ storeId, id, initial, onSaved, onCancel }: {
  storeId: string; id?: string; initial: MenuInput; onSaved: () => Promise<void>; onCancel: () => void;
}) {
  const [menu, setMenu] = useState<MenuInput>(initial);
  const [price, setPrice] = useState(id ? String(initial.price) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const input = { ...menu, price: Number(price) };
    const problem = price.trim() ? validateMenu(input) : '가격을 입력해 주세요.';
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try { await saveMenu(storeId, input, id); await onSaved(); }
    catch (cause) { setError(errorText(cause, '저장하지 못했어요.')); setBusy(false); }
  }

  return (
    <form className="op-form op-menu-form" onSubmit={submit}>
      <div className="op-form-grid">
        <label>메뉴 이름<input autoFocus required maxLength={100} value={menu.name} onChange={(e) => setMenu({ ...menu, name: e.target.value })} /></label>
        <label>가격 (원)<input type="number" required inputMode="numeric" min={0} max={10_000_000} step={1} value={price} onChange={(e) => setPrice(e.target.value)} /></label>
      </div>
      <div className="op-form-grid">
        <label>메뉴판 묶음 (선택)<input maxLength={200} value={menu.section} onChange={(e) => setMenu({ ...menu, section: e.target.value })} placeholder="식사류" /></label>
        <label>종류
          <select value={menu.kind ?? ''} onChange={(e) => setMenu({ ...menu, kind: (e.target.value || null) as MenuKind | null })}>
            <option value="">선택 안 함</option>
            {(Object.keys(MENU_KIND_LABELS) as MenuKind[]).map((k) => <option key={k} value={k}>{MENU_KIND_LABELS[k]}</option>)}
          </select>
        </label>
      </div>
      <label>설명 (선택)<input maxLength={300} value={menu.description} onChange={(e) => setMenu({ ...menu, description: e.target.value })} placeholder="HOT / ICE 선택" /></label>
      {error && <p className="op-error" role="alert">{error}</p>}
      <div className="op-row-actions">
        <button type="button" className="op-secondary" onClick={onCancel} disabled={busy}>취소</button>
        <button type="submit" className="op-primary" disabled={busy}>{busy ? '저장 중…' : '메뉴 저장'}</button>
      </div>
    </form>
  );
}
