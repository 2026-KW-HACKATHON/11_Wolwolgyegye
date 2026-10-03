import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_STORES, MOCK_USER_LOCATION } from '../../core/mock/stores';
import { fetchPublicStores } from '../../core/supabase/stores';
import type { Store } from '../../core/types/place';
import { distanceMeters } from '../../core/utils/geo';
import { fetchNeighborhoodCatalog, mergeNeighborhoodStores } from '../../core/utils/neighborhoodCatalog';
import { STORE_CATEGORIES, storeCategory, type StoreCategory } from '../../core/utils/storeCategories';
import Icon from '../../shared/Icon';
import { kakaoMapLink } from '../../shared/map/kakaoSdk';
import KakaoMap from './KakaoMap';
import { groupMapStores } from './mapStoreGroups';

type MapFilter = 'all' | 'space-rental' | 'oneday-class' | 'closing-sale';
const FILTERS: { key: MapFilter; label: string }[] = [
  { key: 'all', label: '모든 서비스' }, { key: 'space-rental', label: '공간 대여' },
  { key: 'oneday-class', label: '원데이클래스' }, { key: 'closing-sale', label: '마감 할인' },
];
const DEMO_STORES = MOCK_STORES.filter((store) =>
  store.supports['space-rental'] || store.supports['oneday-class'] ||
  store.supports['closing-sale'] || store.supports.coupon || store.supports['partner-stores']);
const HAS_SUPABASE_CONFIG = Boolean(import.meta.env.VITE_SUPABASE_URL?.trim() &&
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim());

function distanceLabel(store: Store) {
  const meters = distanceMeters(MOCK_USER_LOCATION, store.location);
  return meters < 1000 ? Math.round(meters / 10) * 10 + 'm' : (meters / 1000).toFixed(1) + 'km';
}

export default function NearbyScreen({ selectedId, onSelect, onShowMap }: {
  selectedId: string | null; onSelect: (id: string | null) => void; onShowMap: () => void;
}) {
  const [filter, setFilter] = useState<MapFilter>('all');
  const [category, setCategory] = useState<StoreCategory>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [stores, setStores] = useState<Store[]>(HAS_SUPABASE_CONFIG ? [] : DEMO_STORES);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(HAS_SUPABASE_CONFIG ? 'loading' : 'ready');
  const [sourceWarning, setSourceWarning] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!HAS_SUPABASE_CONFIG) return;
    const controller = new AbortController();
    Promise.allSettled([fetchNeighborhoodCatalog(controller.signal), fetchPublicStores(controller.signal)]).then(([catalog, published]) => {
      if (controller.signal.aborted) return;
      if (catalog.status === 'rejected' && published.status === 'rejected') {
        setLoadState('error');
        return;
      }
      setStores(mergeNeighborhoodStores(
        catalog.status === 'fulfilled' ? catalog.value : [],
        published.status === 'fulfilled' ? published.value : [],
      ));
      setSourceWarning(catalog.status === 'rejected' ? '공공데이터 목록을 가져오지 못해 일부 가게만 보여요.' :
        published.status === 'rejected' ? '사장님이 수정한 최신 정보는 잠시 확인할 수 없어요.' : '');
      setLoadState('ready');
    });
    return () => controller.abort();
  }, [retry]);
  const serviceStores = useMemo(() => stores.filter((store) => filter === 'all' || store.supports[filter]), [filter, stores]);
  const visibleStores = useMemo(() => serviceStores.filter((store) =>
    category === 'all' || storeCategory(store.cuisineType) === category), [category, serviceStores]);
  const mapGroups = useMemo(() => groupMapStores(visibleStores), [visibleStores]);
  const selectedGroup = mapGroups.find((group) => group.key === selectedGroupKey);
  const selected = visibleStores.find((store) => store.id === selectedId);
  const selectedAddressGroup = selected && mapGroups.find((group) => group.stores.some((store) => store.id === selected.id));
  const query = searchTerm.trim().toLocaleLowerCase();
  const searchMatches = useMemo(() => query ? stores.filter((store) =>
    [store.name, store.address, store.cuisineType ?? ''].some((value) => value.toLocaleLowerCase().includes(query))) : [], [query, stores]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  useEffect(() => {
    // 다른 화면에서 가게를 선택했을 때 현재 필터에 가려지지 않게 한다.
    const selectedStore = stores.find((store) => store.id === selectedId);
    if (!selectedStore) return;
    if (filter !== 'all' && !selectedStore.supports[filter]) setFilter('all');
    if (category !== 'all' && storeCategory(selectedStore.cuisineType) !== category) setCategory('all');
  }, [selectedId, filter, category, stores]);

  const mapLink = HAS_SUPABASE_CONFIG && selected ? kakaoMapLink(selected.name, selected.location.lat, selected.location.lng) : null;

  function selectStore(id: string) {
    setSelectedGroupKey(null);
    setSearchOpen(false);
    onSelect(id);
  }

  function selectGroup(key: string) {
    setSelectedGroupKey(key);
    setSearchOpen(false);
    onSelect(null);
  }

  return <div className={'rp-nearby' + (searchOpen ? ' rp-nearby--searching' : '')}>
    <KakaoMap stores={visibleStores} groups={mapGroups} selectedId={selectedId} onSelect={selectStore} onSelectGroup={selectGroup} />
    <div className="rp-map-top">
      <div><span className="rp-location-icon"><Icon name="pin" /></span><div><strong>월계1동</strong><span>우리 동네에서 발견하기</span></div></div>
      <div className="rp-map-top-actions"><button type="button" onClick={() => { onShowMap(); setSearchOpen((open) => !open); }} aria-expanded={searchOpen} aria-controls="rp-store-search"><Icon name="search" /> 가게 찾기</button><button type="button" onClick={onShowMap}>지도 <Icon name="chevronRight" /></button></div>
    </div>
    {searchOpen && <div id="rp-store-search" className="rp-map-search-panel">
      <div className="rp-map-search-input"><Icon name="search" /><input ref={searchRef} type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="가게 이름·업종·주소 검색" aria-label="월계1동 가게 검색" /><button type="button" onClick={() => setSearchOpen(false)} aria-label="검색 닫기">×</button></div>
      {query ? <><p>{searchMatches.length}곳 검색됨{searchMatches.length > 30 ? ' · 처음 30곳 표시' : ''}</p><div className="rp-map-search-results">{searchMatches.slice(0, 30).map((store) => <button key={store.id} type="button" onClick={() => { selectStore(store.id); onShowMap(); }}><strong>{store.name}</strong><small>{store.cuisineType ? `${store.cuisineType} · ` : ''}{store.address}</small></button>)}{!searchMatches.length && <span className="rp-map-search-empty">찾는 가게가 없어요. 다른 이름으로 검색해 보세요.</span>}</div></> : <p>김가네처럼 가게 이름을 입력해 보세요.</p>}
    </div>}
    <div className="rp-map-categories" aria-label="가게 업종별 보기">{STORE_CATEGORIES.map((item) => {
      const count = item.key === 'all' ? serviceStores.length : serviceStores.filter((store) => storeCategory(store.cuisineType) === item.key).length;
      return <button key={item.key} type="button" className={category === item.key ? 'is-active' : ''} aria-pressed={category === item.key} onClick={() => { setCategory(item.key); setSelectedGroupKey(null); onSelect(null); }}>{item.label}<small>{count}</small></button>;
    })}</div>
    <div className="rp-map-filters" aria-label="가게 서비스별 보기">{FILTERS.map((item) =>
      <button key={item.key} type="button" className={filter === item.key ? 'is-active' : ''} aria-pressed={filter === item.key} onClick={() => { setFilter(item.key); setSelectedGroupKey(null); onSelect(null); }}>{item.label}</button>
    )}</div>
    {selectedGroup ? <div className="rp-map-bottom rp-address-group" aria-live="polite">
      <div className="rp-group-header"><div><small>같은 주소의 가게</small><strong>{selectedGroup.stores.length}곳을 골라 보세요</strong><span>{selectedGroup.address}</span></div><button type="button" onClick={() => setSelectedGroupKey(null)} aria-label="가게 목록 닫기">×</button></div>
      <div className="rp-group-list">{selectedGroup.stores.map((store) => <button key={store.id} type="button" onClick={() => selectStore(store.id)}><span><strong>{store.name}</strong><small>{store.cuisineType || '업종 정보 없음'}</small></span><Icon name="chevronRight" /></button>)}</div>
    </div> : selected ? <div className="rp-map-bottom rp-selected-store" aria-live="polite">
      <div className="rp-selected-header"><span className="rp-selected-icon"><Icon name="storefront" /></span><div><small>선택한 동네 가게</small><strong>{selected.name}</strong></div><button type="button" onClick={() => onSelect(null)} aria-label="가게 선택 해제">×</button></div>
      <p>{selected.cuisineType ? `${selected.cuisineType} · ` : ''}{selected.address}</p><p className="rp-selected-distance">월계1동 기준점에서 직선 {distanceLabel(selected)} · {HAS_SUPABASE_CONFIG ? '공공데이터 기준 정보일 수 있어요. 방문 전 영업 여부를 확인해 주세요' : '예시 위치'}</p>
      {selectedAddressGroup && selectedAddressGroup.stores.length > 1 && <button type="button" className="rp-same-address" onClick={() => selectGroup(selectedAddressGroup.key)}>이 주소의 다른 가게 {selectedAddressGroup.stores.length - 1}곳 보기 <Icon name="chevronRight" /></button>}
      <div className="rp-selected-actions">
        {selected.supports['space-rental'] && <Link to="/space-rental">공간 소식 보기 <Icon name="chevronRight" /></Link>}
        {selected.supports['oneday-class'] && <Link to="/oneday-class">수업 소식 보기 <Icon name="chevronRight" /></Link>}
        {selected.supports['closing-sale'] && <Link to="/closing-sale">마감 할인 보기 <Icon name="chevronRight" /></Link>}
        {!selected.supports['space-rental'] && !selected.supports['oneday-class'] && !selected.supports['closing-sale'] && selected.supports['partner-stores'] && <Link to="/partner-stores">제휴 혜택 보기 <Icon name="chevronRight" /></Link>}
        {mapLink && <a href={mapLink} target="_blank" rel="noopener noreferrer">카카오맵에서 보기 <Icon name="chevronRight" /></a>}
      </div>
    </div> : <div className="rp-map-bottom rp-map-hint" role={loadState === 'error' ? 'alert' : 'status'}><Icon name="pin" /><span>
      {loadState === 'loading' ? '동네 가게를 불러오는 중이에요' : loadState === 'error' ? '가게 목록을 불러오지 못했어요' : visibleStores.length ? '가게 표시를 눌러 위치를 확인하세요' : '이 분류에 공개된 가게가 아직 없어요'}
      <small>{loadState === 'ready' ? HAS_SUPABASE_CONFIG ? `${visibleStores.length}곳 표시 · 일부는 2026년 6월 공공데이터 기준` : `${visibleStores.length}곳의 예시 가게` : loadState === 'error' ? '연결 상태를 확인하고 다시 시도해 주세요' : '잠시만 기다려 주세요'}</small>
      {sourceWarning && <small>{sourceWarning}</small>}
      {loadState === 'error' && <button type="button" onClick={() => { setSourceWarning(''); setLoadState('loading'); setRetry((n) => n + 1); }}>다시 시도</button>}
    </span></div>}
  </div>;
}
