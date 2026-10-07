import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MENU_KIND_LABELS } from '../../core/source/storeDetail';
import ExtraIcon from '../../shared/ExtraIcon';
import { COLLEGES } from './colleges';
import { AUDIENCE_STORAGE_KEY, isAudience, money } from './presentation';
import { fetchPartnerStores } from './source';
import type { PartnerAudience, PartnerStoreView } from './types';
import './partner.css';

export const AUDIENCE_EVENT = 'wol-partner-audience-changed';

export function readAudience(): PartnerAudience {
  try {
    const value = localStorage.getItem(AUDIENCE_STORAGE_KEY);
    return isAudience(value) ? value : 'all';
  } catch { return 'all'; }
}

export function saveAudience(value: PartnerAudience) {
  try { localStorage.setItem(AUDIENCE_STORAGE_KEY, value); } catch { /* 현재 화면에서만 유지 */ }
  window.dispatchEvent(new Event(AUDIENCE_EVENT));
}

function PartnerDetail({ view }: { view: PartnerStoreView }) {
  const colleges = COLLEGES.filter((college) => view.colleges.includes(college.key));
  const groups = useMemo(() => {
    const result = new Map<string, typeof view.menus>();
    for (const menu of view.menus) {
      const label = menu.section || (menu.kind ? MENU_KIND_LABELS[menu.kind] : '메뉴');
      result.set(label, [...(result.get(label) ?? []), menu]);
    }
    return [...result];
  }, [view.menus]);

  return <div className="ps-detail">
    <div className="ps-detail-offer">
      <b>제휴 단과대</b>
      <div className="ps-tags" aria-label="제휴 단과대 목록">
        {colleges.map((college) => <span key={college.key}>{college.name}</span>)}
      </div>
      <p>선택한 단과대와 제휴된 가게예요. 세부 이용 조건은 방문 전에 가게에 확인해 주세요.</p>
    </div>

    <section className="ps-detail-section">
      <h4>전체 메뉴 <span>{view.menus.length}개</span></h4>
      {groups.length ? groups.map(([label, menus]) => <div className="ps-menu-group" key={label}>
        <h5>{label}</h5>
        <ul className="ps-menu-list">{menus.map((menu) => <li key={menu.id}>
          <span>{menu.name}{menu.description && <small>{menu.description}</small>}</span>
          <b>{money(menu.price)}</b>
        </li>)}</ul>
      </div>) : <p className="ps-note">등록된 메뉴·가격이 없어요.</p>}
    </section>

    {view.store.supports.coupon && <Link className="ps-stamp-link" to={`/coupon?store=${encodeURIComponent(view.storeId)}`}>
      <span className="ps-stamp-link-icon"><ExtraIcon name="stamp" /></span>
      <span><b>이 가게의 스탬프도 확인하기</b></span>
    </Link>}
  </div>;
}

export default function PartnerSection({ storeId }: { storeId: string }) {
  const [view, setView] = useState<PartnerStoreView | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPartnerStores()
      .then((list) => { if (!cancelled) setView(list.find((item) => item.storeId === storeId) ?? null); })
      .catch(() => { if (!cancelled) setView(null); });
    return () => { cancelled = true; };
  }, [storeId]);
  if (!view) return null;
  return <div className="ps-page ps-page--detail" data-sd-target={`partner-${storeId}`}><PartnerDetail view={view} /></div>;
}
