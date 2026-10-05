import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ExtraIcon from '../../shared/ExtraIcon';
import { COLLEGES } from './colleges';
import { fetchPartnerStores } from './source';
import { AUDIENCE_STORAGE_KEY, collegeOf, estimatePrice, isAudience, money } from './presentation';
import type { PartnerAudience, PartnerStoreView } from './types';
import './partner.css';

/** 내 소속(혜택 대상)이 바뀌었다고 알리는 이벤트. 1차 탭 목록과 2차 탭 상세가 같은 선택을 쓴다 */
export const AUDIENCE_EVENT = 'wol-partner-audience-changed';

export function readAudience(): PartnerAudience {
  try { const value = localStorage.getItem(AUDIENCE_STORAGE_KEY); return isAudience(value) ? value : 'all'; }
  catch { return 'all'; }
}
export function saveAudience(value: PartnerAudience) {
  try { localStorage.setItem(AUDIENCE_STORAGE_KEY, value); } catch { /* 이번 화면에서만 유지 */ }
  window.dispatchEvent(new Event(AUDIENCE_EVENT));
}

function AudienceSelect({ value, onChange, id }: { value: PartnerAudience; onChange: (value: PartnerAudience) => void; id: string }) {
  return <select id={id} value={value} onChange={(e) => { if (isAudience(e.target.value)) onChange(e.target.value); }}>
    <option value="all">전체 혜택 둘러보기</option>
    <optgroup label="광운대학교 단과대학">{COLLEGES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</optgroup>
  </select>;
}

/**
 * 제휴 혜택 상세 (1차 탭의 "혜택 자세히" 내용). 2차 탭 안에서 쓴다.
 * 가게 주소·영업시간·전화는 2차 탭 위쪽 가게 정보에 있어서 여기서는 다시 보여주지 않는다.
 */
function PartnerDetail({ view }: { view: PartnerStoreView }) {
  const [audience, setAudience] = useState<PartnerAudience>(readAudience);
  const [presenting, setPresenting] = useState(false);
  useEffect(() => {
    const sync = () => setAudience(readAudience());
    window.addEventListener(AUDIENCE_EVENT, sync);
    return () => window.removeEventListener(AUDIENCE_EVENT, sync);
  }, []);
  const changeAudience = (value: PartnerAudience) => { setAudience(value); saveAudience(value); };

  const college = collegeOf(audience);
  const current = COLLEGES.find((c) => c.key === college);
  const eligible = !!(college && view.benefits[college]);
  const demo = view.dataMode === 'demo';

  return <div className="ps-detail">
    {demo && <div className="ps-demo"><b>미리보기</b><span>실제 제휴·쿠폰이 아닙니다. 매장에서 사용할 수 없어요.</span></div>}
    {presenting ? <>
      <div className="ps-presentation"><span>{current?.name}</span><strong>{college ? view.benefits[college] : ''}</strong><p>{view.condition}</p><b>실물 또는 모바일 학생증을 함께 제시해 주세요.</b></div>
      <p className="ps-note">이 화면은 혜택 안내일 뿐, 학생 인증이나 결제·혜택 사용 완료 증명이 아닙니다.</p>
      <button type="button" className="ps-secondary ps-full" onClick={() => setPresenting(false)}>상세 정보로 돌아가기</button>
    </> : <>
      <label className="ps-detail-audience" htmlFor={`ps-detail-audience-${view.storeId}`}>내 혜택 대상<AudienceSelect id={`ps-detail-audience-${view.storeId}`} value={audience} onChange={changeAudience} /></label>
      <div className="ps-detail-offer">
        {eligible ? <>{demo && <span className="ps-status is-demo">예시 혜택</span>}<strong>{college ? view.benefits[college] : ''}</strong></> : <><b>{audience === 'all' ? '내 단과대를 고르면 적용 혜택이 보여요.' : '선택한 대상의 혜택은 등록되지 않았어요.'}</b><p>아래 대상별 혜택을 참고해 주세요.</p></>}
        <ul className="ps-benefit-list">{COLLEGES.filter((c) => view.benefits[c.key]).map((c) => <li key={c.key} className={college === c.key ? 'is-on' : ''}><span>{c.label}</span><b>{view.benefits[c.key]}</b></li>)}</ul>
      </div>
      {view.condition && <section className="ps-detail-section"><h4>이용 조건</h4><p className="ps-condition">{view.condition}</p></section>}
      <section className="ps-detail-section"><h4>메뉴와 가격 {demo && <span>예시</span>}</h4>
        {view.menus.length ? <><ul className="ps-menu-list">{view.menus.map((menu) => {
          const price = estimatePrice(menu, college);
          return <li key={menu.id}><span>{menu.name}</span><span>{price !== null ? <><del>{money(menu.price)}</del><b>{money(price)}</b></> : <b>{money(menu.price)}</b>}</span></li>;
        })}</ul>{college && <p className="ps-note">최종 금액은 매장에서 확인해 주세요.</p>}</> : <p className="ps-note">등록된 메뉴·가격이 없어요.</p>}
      </section>
      {view.store.supports.coupon && <Link className="ps-stamp-link" to={`/coupon?store=${encodeURIComponent(view.storeId)}`}><span className="ps-stamp-link-icon"><ExtraIcon name="stamp" /></span><span><b>이 가게의 스탬프도 모을 수 있어요</b></span></Link>}
      <div className="ps-detail-bottom"><button type="button" className="ps-primary ps-full" disabled={!eligible} onClick={() => setPresenting(true)}>{!eligible ? '혜택 대상 단과대를 선택해 주세요' : demo ? '혜택 안내 화면 미리보기' : '직원에게 혜택 안내 보여주기'}</button></div>
    </>}
  </div>;
}

/**
 * 2차 탭 안의 "제휴 혜택" 묶음. 그 가게에 제휴 혜택이 없으면 아무것도 그리지 않는다.
 * (가게 메뉴는 여기서 단과대 할인과 함께 보여주므로, 2차 탭의 기본 메뉴 칸은 이 묶음이 있을 때 숨긴다)
 */
export default function PartnerSection({ storeId }: { storeId: string }) {
  const [view, setView] = useState<PartnerStoreView | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPartnerStores()
      .then((list) => { if (!cancelled) setView(list.find((v) => v.storeId === storeId) ?? null); })
      .catch(() => { if (!cancelled) setView(null); });
    return () => { cancelled = true; };
  }, [storeId]);
  if (!view) return null;
  return <div className="ps-page ps-page--detail" data-sd-target={`partner-${storeId}`}><PartnerDetail view={view} /></div>;
}
