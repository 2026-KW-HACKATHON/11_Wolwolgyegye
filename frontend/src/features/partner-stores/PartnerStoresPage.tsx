import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useShell } from '../../layout/AppShell/ShellContext';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import Icon from '../../shared/Icon';
import { useFavoriteStores } from '../../shared/favorites/useFavoriteStores';
import { COLLEGES } from './colleges';
import { AUDIENCE_EVENT, readAudience, saveAudience } from './PartnerSection';
import { collegeOf, distanceLabel, industryOf } from './presentation';
import { useMyCollege } from './myCollege';
import { fetchPartnerStores } from './source';
import type { PartnerAudience, PartnerIndustry, PartnerStoreView } from './types';
import './partner.css';

const INDUSTRIES: PartnerIndustry[] = ['전체', '음식점', '카페·베이커리', '생활·문화'];
const SORTS = [
  { key: 'near', label: '가까운순' },
  { key: 'menus', label: '메뉴 많은순' },
  { key: 'name', label: '이름순' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];
/** 내 소속 줄에 바로 보이는 단과대 수 (나머지는 더보기) */
const QUICK_COLLEGES = 3;

export default function PartnerStoresPage() {
  const active = usePageActive();
  const { openStore, setMapStoreIds } = useShell();
  const location = useLocation();
  const navigate = useNavigate();
  const { isFavorite, toggle } = useFavoriteStores();
  const [stores, setStores] = useState<PartnerStoreView[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [audience, setAudience] = useState<PartnerAudience>(readAudience);
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState<PartnerIndustry>('전체');
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('near');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [collegesOpen, setCollegesOpen] = useState(false);
  const myCollege = useMyCollege();
  const college = collegeOf(audience);
  const current = COLLEGES.find((item) => item.key === college);

  useEffect(() => {
    let cancelled = false;
    setStores(null);
    setError(false);
    fetchPartnerStores()
      .then((list) => { if (!cancelled) setStores(list); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => { if (readAudience() !== audience) saveAudience(audience); }, [audience]);
  // 내 단과대를 등록해 두었으면 제휴 가게 화면에 들어올 때마다 그 단과대 제휴 가게부터 보여준다.
  // 이 화면은 탭을 옮겨도 숨겨질 뿐이라, 보일 때(active)마다 다시 맞춘다. 화면 안에서 다른 칩을 고르는 건 자유
  useEffect(() => {
    if (active && myCollege) {
      setAudience(myCollege);
      setCollegesOpen(false);
    }
  }, [active, myCollege]);
  useEffect(() => {
    const sync = () => setAudience(readAudience());
    window.addEventListener(AUDIENCE_EVENT, sync);
    return () => window.removeEventListener(AUDIENCE_EVENT, sync);
  }, []);

  const linkedId = new URLSearchParams(location.search).get('store');
  useEffect(() => {
    if (!active || !linkedId || !stores) return;
    if (stores.some((view) => view.storeId === linkedId)) setFocusId(linkedId);
    navigate('/partner-stores', { replace: true });
  }, [active, linkedId, stores, navigate]);

  const changeFilters = (change: () => void) => { setFocusId(null); change(); };
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = (view: PartnerStoreView) => (!college || view.colleges.includes(college))
    && (!savedOnly || isFavorite(view.storeId))
    && (industry === '전체' || industryOf(view) === industry)
    && `${view.store.name} ${view.store.cuisineType ?? ''} ${view.menus.map((menu) => menu.name).join(' ')}`
      .toLocaleLowerCase().includes(normalizedQuery);
  const visible = (stores ?? []).filter(matches).sort((a, b) => {
    if (sort === 'name') return a.store.name.localeCompare(b.store.name, 'ko');
    if (sort === 'menus') return b.menus.length - a.menus.length || a.store.name.localeCompare(b.store.name, 'ko');
    return a.referenceDistanceMeters - b.referenceDistanceMeters;
  });

  const focused = focusId ? stores?.find((view) => view.storeId === focusId) ?? null : null;
  const list = focused ? [focused, ...visible.filter((view) => view.storeId !== focused.storeId)] : visible;
  const mapIds = focused ? [focused.storeId, ...visible.filter((view) => view.storeId !== focused.storeId).map((view) => view.storeId)] : visible.map((view) => view.storeId);
  const visibleIds = mapIds.join(',');
  useEffect(() => {
    if (!active) return;
    setMapStoreIds(visibleIds ? visibleIds.split(',') : []);
    return () => setMapStoreIds(null);
  }, [active, visibleIds, setMapStoreIds]);

  const collegeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: stores?.length ?? 0 };
    for (const item of COLLEGES) counts[item.key] = (stores ?? []).filter((view) => view.colleges.includes(item.key)).length;
    return counts;
  }, [stores]);
  // 자주 쓰는 칩(혜택이 많은 단과대 3곳 + 지금 고른 곳)만 바로 보여주고 나머지는 '더보기' 패널에 넣는다
  const quickColleges = useMemo(() => {
    const top = [...COLLEGES].filter((c) => (collegeCounts[c.key] ?? 0) > 0)
      .sort((a, b) => collegeCounts[b.key] - collegeCounts[a.key]).slice(0, QUICK_COLLEGES);
    const picked = COLLEGES.find((c) => c.key === audience);
    return COLLEGES.filter((c) => top.includes(c) || c === picked);
  }, [collegeCounts, audience]);
  const moreColleges = COLLEGES.filter((c) => !quickColleges.includes(c));
  // 칩 숫자는 고른 칩에만 붙인다 (모든 칩의 0개 배지는 소음). 개수는 읽기 프로그램용 이름에 넣는다
  const audienceChip = (key: PartnerAudience, label: string, name: string) => {
    const on = audience === key;
    const count = collegeCounts[key] ?? 0;
    return <button key={key} type="button" className={on ? 'is-on' : ''} aria-pressed={on} title={name} aria-label={`${name} (${count}곳)`}
      onClick={() => changeFilters(() => { setAudience(key); setCollegesOpen(false); })}>
      {label}{on && <span>{count}</span>}
    </button>;
  };

  const hasFilters = !!query || industry !== '전체' || savedOnly;
  const resetFilters = () => changeFilters(() => { setQuery(''); setIndustry('전체'); setSavedOnly(false); });
  const listTitle = current ? `${current.label} 제휴 가게` : '단과대별 제휴 가게';

  return <div className="ps-page">
    <section className="ps-audience" aria-labelledby="ps-audience-title">
      <div className="ps-audience-head">
        <h2 id="ps-audience-title">소속 단과대</h2>
        <p>선택하면 지도와 목록에 해당 제휴 가게만 표시돼요</p>
      </div>
      <div className="ps-colleges" role="group" aria-label="단과대 선택">
        {audienceChip('all', '전체', '전체 제휴 가게')}
        {quickColleges.map((c) => audienceChip(c.key, c.label, c.name))}
        {moreColleges.length > 0 && <button type="button" className="ps-more-chip" aria-expanded={collegesOpen} aria-controls="ps-college-panel" onClick={() => setCollegesOpen(!collegesOpen)}>
          단과대 더보기<Icon name={collegesOpen ? 'chevronUp' : 'chevronDown'} />
        </button>}
      </div>
      {collegesOpen && moreColleges.length > 0 && <div className="ps-college-panel" id="ps-college-panel" role="group" aria-label="다른 단과대">
        {moreColleges.map((c) => audienceChip(c.key, c.label, c.name))}
      </div>}
    </section>

    <div className="ps-tools">
      <label className="ps-search"><Icon name="search" /><input type="search" aria-label="가게 또는 메뉴 검색" placeholder="가게·메뉴 검색" value={query} onChange={(event) => changeFilters(() => setQuery(event.target.value))} /></label>
      <button className={`ps-saved${savedOnly ? ' is-on' : ''}`} type="button" aria-pressed={savedOnly} onClick={() => changeFilters(() => setSavedOnly(!savedOnly))}><Icon name="heart" /><span>찜</span></button>
    </div>
    <div className="ps-filters" role="group" aria-label="업종 선택">{INDUSTRIES.map((item) => <button type="button" key={item} aria-pressed={industry === item} className={industry === item ? 'is-on' : ''} onClick={() => changeFilters(() => setIndustry(item))}>{item}</button>)}</div>

    <section className="ps-results" aria-labelledby="ps-list-title" aria-busy={!stores && !error}>
      <div className="ps-list-head"><div><h2 id="ps-list-title">{listTitle} <span>{stores ? visible.length : '—'}</span></h2>{hasFilters && <button className="ps-text-button" type="button" onClick={resetFilters}>조건 초기화</button>}</div>
        <select className="ps-sort" aria-label="가게 정렬" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>{SORTS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select>
      </div>
      <p className="ps-sr" role="status">{error ? '가게를 불러오지 못했습니다.' : stores ? `${visible.length}개 가게가 검색되었습니다.` : '가게를 불러오는 중입니다.'}</p>
      {!stores && !error && <div className="ps-list" aria-hidden="true">{[0, 1, 2].map((number) => <div className="ps-skeleton" key={number} />)}</div>}
      {error && <div className="ps-empty"><h3>가게 정보를 불러오지 못했어요.</h3><p>잠시 후 다시 시도해 주세요.</p><button className="ps-primary" type="button" onClick={() => setAttempt(attempt + 1)}>다시 불러오기</button></div>}
      {stores && !list.length && <div className="ps-empty"><Icon name="storefront" /><h3>조건에 맞는 제휴 가게가 없어요.</h3><p>다른 단과대나 검색 조건을 선택해 보세요.</p><button className="ps-secondary" type="button" onClick={resetFilters}>검색·필터 초기화</button></div>}
      {!!list.length && <ul className="ps-list">{list.map((view) => {
        const colleges = COLLEGES.filter((item) => view.colleges.includes(item.key));
        const favorite = isFavorite(view.storeId);
        const cafe = industryOf(view) === '카페·베이커리';
        return <li className={`ps-card${view.storeId === focusId ? ' is-focus' : ''}`} key={view.storeId} id={`ps-store-${view.storeId}`}>
          <div className="ps-card-top">
            <span className={`ps-store-icon${cafe ? ' is-cafe' : ''}`} aria-hidden="true"><Icon name={cafe ? 'coffee' : 'storefront'} /></span>
            <div className="ps-card-title"><p>{view.store.cuisineType ?? '생활·문화'} · 기준점 {distanceLabel(view.referenceDistanceMeters)}</p><h3>{view.store.name}</h3></div>
            <button className={`ps-heart${favorite ? ' is-on' : ''}`} type="button" aria-label={`${view.store.name} 찜 ${favorite ? '해제' : '하기'}`} aria-pressed={favorite} onClick={() => toggle(view.storeId)}><Icon name="heart" /></button>
          </div>
          <div className="ps-tags" aria-label="제휴 단과대">{colleges.map((item) => <span className={college === item.key ? 'is-on' : ''} key={item.key}>{item.label}</span>)}</div>
          <div className="ps-card-foot"><button type="button" className="ps-more" onClick={() => openStore(view.storeId, { category: 'partner-stores' })}>지도에서 보기 <Icon name="chevronRight" /></button></div>
        </li>;
      })}</ul>}
    </section>
    <p className="ps-disclaimer">단과대 제휴 여부와 메뉴·가격은 제공받은 엑셀 자료를 기준으로 표시합니다. 방문 전 최신 이용 조건을 가게에 확인해 주세요.</p>
  </div>;
}
