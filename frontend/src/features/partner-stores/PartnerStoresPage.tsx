import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getUserLocation } from '../../core/source/storeSource';
import type { GeoPoint } from '../../core/types/place';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import ExtraIcon from '../../shared/ExtraIcon';
import Icon from '../../shared/Icon';
import { useFavoriteStores } from '../../shared/favorites/useFavoriteStores';
import StoreMap, { directionText } from '../../shared/map/StoreMap';
import Sheet from '../../shared/sheet/Sheet';
import { COLLEGES } from './mock';
import { fetchPartnerStores } from './source';
import { AUDIENCE_STORAGE_KEY, STATUS_LABELS, benefitStatus, collegeOf, distanceLabel, estimatePrice, industryOf, isAudience, mapUrl, money, phoneUrl, safeSourceUrl } from './presentation';
import type { PartnerAudience, PartnerIndustry, PartnerStoreView } from './types';
import './partner.css';

const INDUSTRIES: PartnerIndustry[] = ['전체', '음식점', '카페·베이커리', '생활·문화'];
const SORTS = [
  { key: 'near', label: '가까운순' },
  { key: 'benefits', label: '혜택 많은순' },
  { key: 'name', label: '이름순' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];

function initialAudience(): PartnerAudience {
  try { const value = localStorage.getItem(AUDIENCE_STORAGE_KEY); return isAudience(value) ? value : 'all'; }
  catch { return 'all'; }
}
function AudienceSelect({ value, onChange, id }: { value: PartnerAudience; onChange: (value: PartnerAudience) => void; id: string }) {
  return <select id={id} value={value} onChange={(e) => { if (isAudience(e.target.value)) onChange(e.target.value); }}>
    <option value="all">전체 혜택 둘러보기</option>
    <option value="resident">주민 · 일반 이용자</option>
    <optgroup label="광운대학교 단과대학">{COLLEGES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</optgroup>
  </select>;
}

/**
 * 제휴 가게 화면 (/partner-stores).
 * - 소속 단과대를 고르면 받을 수 있는 혜택만 보여준다. (선택은 이 기기에만 저장)
 * - 가게 이름을 누르면 카드 안, 혜택 설명 아래에 가게 위치 지도가 펼쳐진다.
 * - /partner-stores?store=ID 로 들어오면 그 가게를 맨 위에 보여주고 지도를 펼친다. (스탬프 화면에서 연결)
 */
export default function PartnerStoresPage() {
  const active = usePageActive();
  const location = useLocation();
  const navigate = useNavigate();
  const { isFavorite, toggle } = useFavoriteStores();
  const [stores, setStores] = useState<PartnerStoreView[] | null>(null);
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [audience, setAudience] = useState<PartnerAudience>(initialAudience);
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState<PartnerIndustry>('전체');
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('near');
  const [openMaps, setOpenMaps] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  const [selected, setSelected] = useState<PartnerStoreView | null>(null);
  const [presenting, setPresenting] = useState(false);
  const college = collegeOf(audience);
  const current = COLLEGES.find((c) => c.key === college);

  useEffect(() => {
    let cancelled = false;
    setStores(null); setError(false);
    Promise.all([fetchPartnerStores(), getUserLocation()])
      .then(([list, here]) => { if (!cancelled) { setStores(list); setOrigin(here); } })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [attempt]);
  useEffect(() => { try { localStorage.setItem(AUDIENCE_STORAGE_KEY, audience); } catch { /* session only */ } }, [audience]);
  useEffect(() => { if (!active) { setSelected(null); setPresenting(false); } }, [active]);

  // 다른 화면에서 ?store=ID 로 들어온 경우: 그 가게를 맨 위에 두고 지도를 펼친다
  const linkedId = new URLSearchParams(location.search).get('store');
  useEffect(() => {
    if (!active || !linkedId || !stores) return;
    if (stores.some((v) => v.storeId === linkedId)) {
      setFocusId(linkedId);
      setOpenMaps((ids) => (ids.includes(linkedId) ? ids : [...ids, linkedId]));
      setScrollTo(linkedId);
    }
    navigate('/partner-stores', { replace: true });
  }, [active, linkedId, stores, navigate]);
  useLayoutEffect(() => {
    if (!scrollTo) return;
    document.getElementById(`ps-store-${scrollTo}`)?.scrollIntoView({ block: 'start' });
    setScrollTo(null);
  }, [scrollTo]);

  const changeFilters = (fn: () => void) => { setFocusId(null); fn(); };

  const q = query.trim().toLocaleLowerCase();
  const matches = (v: PartnerStoreView) => audience !== 'resident'
    && (!college || !!v.benefits[college]) && (!savedOnly || isFavorite(v.storeId))
    && (industry === '전체' || industryOf(v) === industry)
    && `${v.store.name} ${v.store.cuisineType ?? ''} ${v.menus.map((m) => m.name).join(' ')} ${Object.values(v.benefits).join(' ')}`.toLocaleLowerCase().includes(q);
  const benefitCount = (v: PartnerStoreView) => Object.keys(v.benefits).length;
  const visible = (stores ?? []).filter(matches).sort((a, b) => {
    if (sort === 'name') return a.store.name.localeCompare(b.store.name, 'ko');
    if (sort === 'benefits') return benefitCount(b) - benefitCount(a) || a.referenceDistanceMeters - b.referenceDistanceMeters;
    return a.referenceDistanceMeters - b.referenceDistanceMeters;
  });
  const focused = focusId ? stores?.find((v) => v.storeId === focusId) ?? null : null;
  const list = focused ? [focused, ...visible.filter((v) => v.storeId !== focused.storeId)] : visible;
  const focusOutside = !!focused && !matches(focused);

  const collegeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: stores?.length ?? 0, resident: 0 };
    COLLEGES.forEach((c) => { counts[c.key] = (stores ?? []).filter((v) => v.benefits[c.key]).length; });
    return counts;
  }, [stores]);

  const hasFilters = !!query || industry !== '전체' || savedOnly;
  const resetFilters = () => changeFilters(() => { setQuery(''); setIndustry('전체'); setSavedOnly(false); });
  const toggleMap = (id: string) => setOpenMaps((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const close = () => { setSelected(null); setPresenting(false); };
  const info = college ? selected?.details?.[college] : undefined;
  const status = benefitStatus(info);
  const eligible = !!(college && selected?.benefits[college]);
  const canPresent = eligible && (status === 'demo' || status === 'verified');
  const source = safeSourceUrl(info?.sourceUrl);
  const locationLink = selected ? mapUrl(selected) : null;
  const telephone = selected ? phoneUrl(selected) : null;
  const listTitle = current ? `${current.label} 학생 혜택` : audience === 'resident' ? '주민·일반 이용자 혜택' : '단과대별 제휴 가게';

  return <div className="ps-page">
    <section className="ps-audience" aria-labelledby="ps-audience-title">
      <div className="ps-audience-head">
        <h2 id="ps-audience-title">내 소속</h2>
        <p>이 기기에만 저장돼요 · 학생 인증은 아니에요</p>
      </div>
      <div className="ps-colleges" role="group" aria-label="혜택 대상 선택">
        <button type="button" className={audience === 'all' ? 'is-on' : ''} aria-pressed={audience === 'all'} onClick={() => changeFilters(() => setAudience('all'))}>전체 혜택<span>{collegeCounts.all}</span></button>
        {COLLEGES.map((c) => (
          <button key={c.key} type="button" className={audience === c.key ? 'is-on' : ''} aria-pressed={audience === c.key} title={c.name} aria-label={`${c.name} (${collegeCounts[c.key] ?? 0}곳)`} onClick={() => changeFilters(() => setAudience(c.key))}>
            {c.label}<span>{collegeCounts[c.key] ?? 0}</span>
          </button>
        ))}
        <button type="button" className={audience === 'resident' ? 'is-on' : ''} aria-pressed={audience === 'resident'} onClick={() => changeFilters(() => setAudience('resident'))}>주민·일반</button>
      </div>
    </section>

    <div className="ps-tools">
      <label className="ps-search"><Icon name="search" /><input type="search" aria-label="가게, 메뉴 또는 혜택 검색" placeholder="가게·메뉴·혜택 검색" value={query} onChange={(e) => changeFilters(() => setQuery(e.target.value))} /></label>
      <button className={`ps-saved${savedOnly ? ' is-on' : ''}`} type="button" aria-pressed={savedOnly} onClick={() => changeFilters(() => setSavedOnly(!savedOnly))}><Icon name="heart" /><span>찜</span></button>
    </div>
    <div className="ps-filters" role="group" aria-label="업종 선택">{INDUSTRIES.map((item) => <button type="button" key={item} aria-pressed={industry === item} className={industry === item ? 'is-on' : ''} onClick={() => changeFilters(() => setIndustry(item))}>{item}</button>)}</div>

    <section className="ps-results" aria-labelledby="ps-list-title" aria-busy={!stores && !error}>
      <div className="ps-list-head">
        <div>
          <h2 id="ps-list-title">{listTitle} <span>{stores ? visible.length : '—'}</span></h2>
          {hasFilters && <button className="ps-text-button" type="button" onClick={resetFilters}>조건 초기화</button>}
        </div>
        <select className="ps-sort" aria-label="가게 정렬" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>{SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
      </div>
      <p className="ps-sr" role="status">{error ? '가게를 불러오지 못했습니다.' : stores ? `${visible.length}개 가게가 검색되었습니다.` : '가게를 불러오는 중입니다.'}</p>
      {!stores && !error && <div className="ps-list" aria-hidden="true">{[0, 1, 2].map((n) => <div className="ps-skeleton" key={n} />)}</div>}
      {error && <div className="ps-empty"><h3>가게 정보를 불러오지 못했어요.</h3><p>잠시 후 다시 시도해 주세요.</p><button className="ps-primary" type="button" onClick={() => setAttempt(attempt + 1)}>다시 불러오기</button></div>}
      {stores && !list.length && <div className="ps-empty"><Icon name="storefront" /><h3>{audience === 'resident' ? '아직 확인된 주민 혜택이 없어요.' : savedOnly ? '조건에 맞는 찜한 가게가 없어요.' : '조건에 맞는 가게가 없어요.'}</h3>
        <p>{audience === 'resident' ? '학생 대상 혜택을 주민 혜택으로 표시하지 않아요. 일반 이용자는 스탬프 적립을 이용해 보세요.' : '다른 검색어나 업종을 선택해 보세요.'}</p>
        {audience === 'resident' ? <div className="ps-empty-actions"><button className="ps-secondary" type="button" onClick={() => { setAudience('all'); resetFilters(); }}>학생 혜택 둘러보기</button><Link className="ps-primary" to="/coupon">스탬프 둘러보기</Link></div> : <button className="ps-secondary" type="button" onClick={resetFilters}>검색·필터 초기화</button>}
      </div>}
      {!!list.length && <ul className="ps-list">{list.map((v) => {
        const colleges = COLLEGES.filter((c) => v.benefits[c.key]);
        const mine = college ? v.benefits[college] : undefined;
        const key = mine ? college! : colleges[0]?.key;
        const cardInfo = key ? v.details?.[key] : undefined;
        const cardStatus = benefitStatus(cardInfo);
        const menu = v.menus[0];
        const price = menu ? estimatePrice(menu, college, cardInfo) : null;
        const fav = isFavorite(v.storeId);
        const open = openMaps.includes(v.storeId);
        const cafe = industryOf(v) === '카페·베이커리';
        const variants = new Set(Object.values(v.benefits)).size;
        const outside = v.storeId === focusId && focusOutside;
        return <li className={`ps-card${open ? ' is-open' : ''}${v.storeId === focusId ? ' is-focus' : ''}`} key={v.storeId} id={`ps-store-${v.storeId}`}>
          <div className="ps-card-top">
            <span className={`ps-store-icon${cafe ? ' is-cafe' : ''}`} aria-hidden="true"><Icon name={cafe ? 'coffee' : 'storefront'} /></span>
            <div className="ps-card-title">
              <p>{v.store.cuisineType ?? '생활·문화'} · 기준점 {distanceLabel(v.referenceDistanceMeters)}</p>
              <h3>
                <button type="button" className="ps-name" aria-expanded={open} aria-controls={`ps-map-${v.storeId}`} onClick={() => toggleMap(v.storeId)}>
                  <span className="ps-name-text">{v.store.name}</span>
                  <span className="ps-name-hint"><ExtraIcon name="map" />{open ? '지도 접기' : '지도'}<Icon name="chevronDown" className="ps-name-chevron" /></span>
                </button>
              </h3>
            </div>
            <button className={`ps-heart${fav ? ' is-on' : ''}`} type="button" aria-label={`${v.store.name} 찜 ${fav ? '해제' : '하기'}`} aria-pressed={fav} onClick={() => toggle(v.storeId)}><Icon name="heart" /></button>
          </div>

          <div className="ps-ticket">
            <div className="ps-ticket-main">
              <span className="ps-ticket-label">
                {outside ? '내 소속 혜택은 없는 가게예요' : current ? `${current.label} 학생 혜택` : variants > 1 ? '단과대마다 달라요' : '단과대 공통 혜택'}
                <span className={`ps-status is-${cardStatus}`}>{STATUS_LABELS[cardStatus]}</span>
              </span>
              <strong>{outside ? (key ? v.benefits[key] : '') : key ? v.benefits[key] : '혜택 확인 필요'}</strong>
              <p>{cardInfo?.condition ?? v.condition}</p>
            </div>
            <div className="ps-ticket-stub" aria-label={`${colleges.length}개 단과대 대상`}>
              <b>{colleges.length}</b><span>개 단과대</span>
            </div>
          </div>

          {menu && <div className="ps-price"><span>{menu.name} <small>예시 가격</small></span><span>{price !== null ? <><del>{money(menu.price)}</del><b>{money(price)}</b></> : money(menu.price)}</span></div>}
          <div className="ps-tags" aria-label="혜택 대상 단과대">{colleges.map((c) => <span className={college === c.key ? 'is-on' : ''} key={c.key}>{c.label}</span>)}</div>

          {open && <div className="ps-map-panel" id={`ps-map-${v.storeId}`}>
            {origin && <StoreMap key={v.storeId} store={v.store} origin={origin} demo={v.dataMode === 'demo'} />}
            <dl className="ps-map-facts">
              <div><dt><Icon name="pin" /><span className="ps-sr">주소</span></dt><dd>{v.store.address}</dd></div>
              <div><dt><ExtraIcon name="clock" /><span className="ps-sr">영업시간</span></dt><dd>{v.store.businessHours}</dd></div>
              {origin && <div><dt><Icon name="compass" /><span className="ps-sr">방향</span></dt><dd>기준점에서 {directionText(origin, v.store.location)}</dd></div>}
            </dl>
          </div>}

          <div className="ps-card-foot">
            {v.store.supports.coupon
              ? <Link className="ps-stamp-chip" to={`/coupon?store=${encodeURIComponent(v.storeId)}`}><ExtraIcon name="stamp" />스탬프 적립판</Link>
              : <span />}
            <button type="button" className="ps-more" onClick={() => { setSelected(v); setPresenting(false); }} aria-label={`${v.store.name} 혜택 자세히`}>혜택 자세히 <Icon name="chevronRight" /></button>
          </div>
        </li>;
      })}</ul>}
    </section>

    <aside className="ps-guide"><span className="ps-guide-icon"><ExtraIcon name="info" /></span><div><b>방문 전 확인하세요</b><p>내가 혜택 대상인지 · 학생증이 필요한지 · 적용 조건과 기간이 맞는지</p></div></aside>
    <p className="ps-disclaimer"><b>시연용 데이터</b> 가게·위치·가격·혜택은 예시이며 실제로 사용할 수 없어요. 거리는 예시 기준점에서 잰 직선거리예요. 광운대학교 공식 서비스가 아니며, 실제 운영 시 학생회 공지와 가게 확인을 거쳐 정보를 제공합니다.</p>

    <Sheet open={!!selected && active} title={presenting ? '혜택 안내 화면' : '제휴 혜택 자세히'} onClose={close}>
      {selected && <div className="ps-detail">
        {selected.dataMode === 'demo' && <div className="ps-demo"><b>미리보기</b><span>실제 제휴·쿠폰이 아닙니다. 매장에서 사용할 수 없어요.</span></div>}
        <div className="ps-detail-heading"><span className="ps-eyebrow">{selected.store.cuisineType ?? '생활·문화'}</span><h3>{selected.store.name}</h3></div>
        {presenting ? <>
          <div className="ps-presentation"><span>{current?.name}</span><strong>{college ? selected.benefits[college] : ''}</strong><p>{info?.condition ?? selected.condition}</p><b>실물 또는 모바일 학생증을 함께 제시해 주세요.</b></div>
          <p className="ps-note">이 화면은 혜택 안내일 뿐, 학생 인증이나 결제·혜택 사용 완료 증명이 아닙니다.</p>
          <button type="button" className="ps-secondary ps-full" onClick={() => setPresenting(false)}>상세 정보로 돌아가기</button>
        </> : <>
          <label className="ps-detail-audience" htmlFor="ps-detail-audience">내 혜택 대상<AudienceSelect id="ps-detail-audience" value={audience} onChange={setAudience} /></label>
          <div className="ps-detail-offer">
            {eligible ? <><span className={`ps-status is-${status}`}>{STATUS_LABELS[status]}</span><strong>{college ? selected.benefits[college] : ''}</strong></> : <><b>{audience === 'all' ? '내 단과대를 고르면 적용 혜택이 보여요.' : '선택한 대상의 혜택은 등록되지 않았어요.'}</b><p>아래 대상별 혜택을 참고해 주세요.</p></>}
            <ul className="ps-benefit-list">{COLLEGES.filter((c) => selected.benefits[c.key]).map((c) => <li key={c.key} className={college === c.key ? 'is-on' : ''}><span>{c.label}</span><b>{selected.benefits[c.key]}</b></li>)}</ul>
          </div>
          <section className="ps-detail-section"><h4>놓치면 안 되는 이용 조건</h4><dl className="ps-facts">
            <div><dt>이용 조건</dt><dd>{info?.condition ?? selected.condition}</dd></div>
            <div><dt>혜택 기간</dt><dd>{info?.validUntil ? `${info.validUntil}까지` : '미등록 · 방문 전 확인 필요'}</dd></div>
            <div><dt>확인일</dt><dd>{info?.verifiedAt ?? '확인된 날짜 없음'}</dd></div>
            <div><dt>공지 출처</dt><dd>{source ? <a href={source} target="_blank" rel="noopener noreferrer">제휴 공지 확인 ↗</a> : '미등록 · 실제 제휴 확인 필요'}</dd></div>
            <div><dt>스탬프 중복</dt><dd>{info?.stampStacking === 'allowed' ? '함께 이용 가능' : info?.stampStacking === 'not-allowed' ? '중복 이용 불가' : '확인되지 않음 · 가게 확인 필요'}</dd></div>
          </dl></section>
          <section className="ps-detail-section"><h4>메뉴와 가격 {selected.dataMode === 'demo' && <span>예시</span>}</h4>
            {selected.menus.length ? <><ul className="ps-menu-list">{selected.menus.map((menu) => {
              const price = estimatePrice(menu, college, info);
              return <li key={menu.id}><span>{menu.name}</span><span>{price !== null ? <><del>{money(menu.price)}</del><b>{money(price)}</b></> : <b>{money(menu.price)}</b>}</span></li>;
            })}</ul><p className="ps-note">{selected.dataMode === 'demo' ? '선택한 단과대의 할인 계산 예시입니다. 실제 결제 금액이 아니에요.' : '등록된 메뉴별 할인만 계산합니다. 최종 금액은 매장에서 확인해 주세요.'}</p></> : <p className="ps-note">등록된 메뉴·가격이 없어요. 확인되지 않은 금액은 표시하지 않아요.</p>}
          </section>
          <section className="ps-detail-section"><h4>가게 찾아가기</h4>
            {origin && <StoreMap key={selected.storeId} store={selected.store} origin={origin} demo={selected.dataMode === 'demo'} className="ps-detail-map" />}
            <dl className="ps-facts"><div><dt>주소</dt><dd>{selected.store.address}</dd></div><div><dt>영업시간</dt><dd>{selected.store.businessHours}</dd></div></dl>
            {selected.dataMode === 'demo' && <p className="ps-note">주소·좌표·영업시간·전화번호도 예시입니다. 실제 방문 정보로 이용하지 마세요.</p>}
            <div className="ps-contact">{locationLink ? <a className="ps-secondary" href={locationLink} target="_blank" rel="noopener noreferrer"><Icon name="pin" />{selected.dataMode === 'demo' ? '예시 위치 보기' : '길찾기'}</a> : <button className="ps-secondary" disabled>위치 미등록</button>}{telephone ? <a className="ps-secondary" href={telephone}>가게에 전화</a> : <button type="button" className="ps-secondary" disabled>{selected.dataMode === 'demo' ? '예시 번호 · 전화 불가' : '전화번호 미등록'}</button>}</div>
          </section>
          {selected.store.supports.coupon && <Link className="ps-stamp-link" to={`/coupon?store=${encodeURIComponent(selected.storeId)}`} onClick={close}><span className="ps-stamp-link-icon"><ExtraIcon name="stamp" /></span><span><b>이 가게의 스탬프도 모을 수 있어요</b><small>제휴 혜택과 중복 적용되는지는 별도 확인이 필요해요.</small></span><Icon name="chevronRight" /></Link>}
          <div className="ps-detail-bottom"><button type="button" className="ps-primary ps-full" disabled={!canPresent} onClick={() => setPresenting(true)}>{!eligible ? '혜택 대상 단과대를 선택해 주세요' : !canPresent ? '혜택 확인 후 이용할 수 있어요' : selected.dataMode === 'demo' ? '혜택 안내 화면 미리보기' : '직원에게 혜택 안내 보여주기'}</button><p className="ps-note">쿠폰 발급·회원 인증 없이 정보를 확인하는 화면입니다.</p></div>
        </>}
      </div>}
    </Sheet>
  </div>;
}
