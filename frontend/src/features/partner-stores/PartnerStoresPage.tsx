import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getUserLocation } from '../../core/source/storeSource';
import type { GeoPoint } from '../../core/types/place';
import { useShell } from '../../layout/AppShell/ShellContext';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import ExtraIcon from '../../shared/ExtraIcon';
import Icon from '../../shared/Icon';
import { useFavoriteStores } from '../../shared/favorites/useFavoriteStores';
import StoreMap, { directionText } from '../../shared/map/StoreMap';
import { COLLEGES } from './colleges';
import { fetchPartnerStores } from './source';
import { AUDIENCE_EVENT, readAudience, saveAudience } from './PartnerSection';
import { collegeOf, distanceLabel, estimatePrice, industryOf, money } from './presentation';
import type { PartnerAudience, PartnerIndustry, PartnerStoreView } from './types';
import './partner.css';

const INDUSTRIES: PartnerIndustry[] = ['전체', '음식점', '카페·베이커리', '생활·문화'];
const SORTS = [
  { key: 'near', label: '가까운순' },
  { key: 'benefits', label: '혜택 많은순' },
  { key: 'name', label: '이름순' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];

/**
 * 제휴 가게 화면 (/partner-stores).
 * - 소속 단과대를 고르면 받을 수 있는 혜택만 보여준다. (선택은 이 기기에만 저장)
 * - 가게 이름을 누르면 카드 안, 혜택 설명 아래에 가게 위치 지도가 펼쳐진다.
 * - /partner-stores?store=ID 로 들어오면 그 가게를 맨 위에 보여주고 지도를 펼친다. (스탬프 화면에서 연결)
 * - "혜택 자세히" 를 누르면 그 가게의 2차 탭이 열리고, 2차 탭의 제휴 혜택 부분이 맨 위에 오도록 스크롤된다.
 */
export default function PartnerStoresPage() {
  const active = usePageActive();
  const { openStore } = useShell();
  const location = useLocation();
  const navigate = useNavigate();
  const { isFavorite, toggle } = useFavoriteStores();
  const [stores, setStores] = useState<PartnerStoreView[] | null>(null);
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [audience, setAudience] = useState<PartnerAudience>(readAudience);
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState<PartnerIndustry>('전체');
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('near');
  const [openMaps, setOpenMaps] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [scrollTo, setScrollTo] = useState<string | null>(null);
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
  // 내 소속은 2차 탭의 혜택 상세와 같은 값을 쓴다 (이 기기에만 저장)
  useEffect(() => { if (readAudience() !== audience) saveAudience(audience); }, [audience]);
  useEffect(() => {
    const sync = () => setAudience(readAudience());
    window.addEventListener(AUDIENCE_EVENT, sync);
    return () => window.removeEventListener(AUDIENCE_EVENT, sync);
  }, []);

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
  const matches = (v: PartnerStoreView) => (!college || !!v.benefits[college]) && (!savedOnly || isFavorite(v.storeId))
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
    const counts: Record<string, number> = { all: stores?.length ?? 0 };
    COLLEGES.forEach((c) => { counts[c.key] = (stores ?? []).filter((v) => v.benefits[c.key]).length; });
    return counts;
  }, [stores]);

  const hasFilters = !!query || industry !== '전체' || savedOnly;
  const resetFilters = () => changeFilters(() => { setQuery(''); setIndustry('전체'); setSavedOnly(false); });
  const toggleMap = (id: string) => setOpenMaps((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const listTitle = current ? `${current.label} 학생 혜택` : '단과대별 제휴 가게';

  return <div className="ps-page">
    <section className="ps-audience" aria-labelledby="ps-audience-title">
      <div className="ps-audience-head">
        <h2 id="ps-audience-title">내 소속</h2>
        <p>이 기기에만 저장돼요</p>
      </div>
      <div className="ps-colleges" role="group" aria-label="혜택 대상 선택">
        <button type="button" className={audience === 'all' ? 'is-on' : ''} aria-pressed={audience === 'all'} onClick={() => changeFilters(() => setAudience('all'))}>전체 혜택<span>{collegeCounts.all}</span></button>
        {COLLEGES.map((c) => (
          <button key={c.key} type="button" className={audience === c.key ? 'is-on' : ''} aria-pressed={audience === c.key} title={c.name} aria-label={`${c.name} (${collegeCounts[c.key] ?? 0}곳)`} onClick={() => changeFilters(() => setAudience(c.key))}>
            {c.label}<span>{collegeCounts[c.key] ?? 0}</span>
          </button>
        ))}
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
      {stores && !list.length && <div className="ps-empty"><Icon name="storefront" /><h3>{savedOnly ? '조건에 맞는 찜한 가게가 없어요.' : '조건에 맞는 가게가 없어요.'}</h3>
        <p>다른 검색어나 업종을 선택해 보세요.</p>
        <button className="ps-secondary" type="button" onClick={resetFilters}>검색·필터 초기화</button>
      </div>}
      {!!list.length && <ul className="ps-list">{list.map((v) => {
        const colleges = COLLEGES.filter((c) => v.benefits[c.key]);
        const mine = college ? v.benefits[college] : undefined;
        const key = mine ? college! : colleges[0]?.key;
        const menu = v.menus[0];
        const price = menu ? estimatePrice(menu, college) : null;
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
                {v.dataMode === 'demo' && <span className="ps-status is-demo">예시 혜택</span>}
              </span>
              <strong>{outside ? (key ? v.benefits[key] : '') : key ? v.benefits[key] : '혜택 확인 필요'}</strong>
              <p>{v.condition}</p>
            </div>
          </div>

          {menu && <div className="ps-price"><span>{menu.name} {v.dataMode === 'demo' && <small>예시 가격</small>}</span><span>{price !== null ? <><del>{money(menu.price)}</del><b>{money(price)}</b></> : money(menu.price)}</span></div>}
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
            <button type="button" className="ps-more" onClick={() => openStore(v.storeId, { category: 'partner-stores' })} aria-label={`${v.store.name} 혜택 자세히`}>혜택 자세히 <Icon name="chevronRight" /></button>
          </div>
        </li>;
      })}</ul>}
    </section>

    <p className="ps-disclaimer">광운대학교 공식 서비스가 아니에요. 학생 인증 없이 혜택 정보만 보여주니, 방문 전 대상·학생증 필요 여부·조건을 가게에 확인해 주세요. 거리는 월계1동 기준점에서 잰 직선거리예요.</p>

  </div>;
}
