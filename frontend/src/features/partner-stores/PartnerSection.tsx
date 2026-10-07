import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MENU_KIND_LABELS } from '../../core/source/storeDetail';
import ExtraIcon from '../../shared/ExtraIcon';
import { COLLEGES } from './colleges';
import { AUDIENCE_STORAGE_KEY, collegeOf, isAudience, money } from './presentation';
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

function PartnerDetail({ view, audience }: { view: PartnerStoreView; audience: PartnerAudience }) {
  const colleges = COLLEGES.filter((college) => view.colleges.includes(college.key));
  const selectedCollege = collegeOf(audience);
  const benefits = selectedCollege
    ? view.benefits.filter((benefit) => benefit.colleges.includes(selectedCollege))
    : view.benefits;
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
      <b>{selectedCollege ? '내 단과대 제휴 혜택' : '단과대별 제휴 혜택'}</b>
      <div className="ps-tags" aria-label="제휴 단과대 목록">
        {colleges.map((college) => <span key={college.key}>{college.name}</span>)}
      </div>
      {benefits.length ? <ul className="ps-benefit-details">{benefits.map((benefit) => {
        const labels = COLLEGES.filter((college) => benefit.colleges.includes(college.key)).map((college) => college.label);
        return <li key={benefit.id}>
          <span>{labels.join(' · ')}</span>
          <strong>{benefit.offer}</strong>
          {benefit.condition && <small>{benefit.condition}</small>}
        </li>;
      })}</ul> : <p>등록된 상세 혜택이 없어요. 방문 전에 가게에 이용 조건을 확인해 주세요.</p>}
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
  const [audience, setAudience] = useState<PartnerAudience>(readAudience);
  useEffect(() => {
    let cancelled = false;
    fetchPartnerStores()
      .then((list) => { if (!cancelled) setView(list.find((item) => item.storeId === storeId) ?? null); })
      .catch(() => { if (!cancelled) setView(null); });
    return () => { cancelled = true; };
  }, [storeId]);
  useEffect(() => {
    const sync = () => setAudience(readAudience());
    window.addEventListener(AUDIENCE_EVENT, sync);
    return () => window.removeEventListener(AUDIENCE_EVENT, sync);
  }, []);
  if (!view) return null;
  return <div className="ps-page ps-page--detail" data-sd-target={`partner-${storeId}`}><PartnerDetail view={view} audience={audience} /></div>;
}
