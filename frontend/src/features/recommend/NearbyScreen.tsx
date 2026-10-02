import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_STORES, MOCK_USER_LOCATION } from '../../core/mock/stores';
import { fetchPublicStores } from '../../core/supabase/stores';
import type { Store } from '../../core/types/place';
import { distanceMeters } from '../../core/utils/geo';
import Icon from '../../shared/Icon';
import { kakaoMapLink } from '../../shared/map/kakaoSdk';
import KakaoMap from './KakaoMap';

type MapFilter = 'all' | 'space-rental' | 'oneday-class' | 'closing-sale';
const FILTERS: { key: MapFilter; label: string }[] = [
  { key: 'all', label: '전체 가게' }, { key: 'space-rental', label: '공간 대여' },
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
  const [stores, setStores] = useState<Store[]>(HAS_SUPABASE_CONFIG ? [] : DEMO_STORES);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(HAS_SUPABASE_CONFIG ? 'loading' : 'ready');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!HAS_SUPABASE_CONFIG) return;
    const controller = new AbortController();
    fetchPublicStores(controller.signal).then((rows) => {
      setStores(rows);
      setLoadState('ready');
    }).catch(() => {
      if (!controller.signal.aborted) setLoadState('error');
    });
    return () => controller.abort();
  }, [retry]);
  const visibleStores = useMemo(() => stores.filter((store) => filter === 'all' || store.supports[filter]), [filter, stores]);
  const selected = visibleStores.find((store) => store.id === selectedId);
  useEffect(() => {
    // 피드에서 선택한 가게가 현재 분류 밖일 때만 전체로 돌아간다.
    if (selectedId && filter !== 'all' && !stores.find((store) => store.id === selectedId)?.supports[filter]) setFilter('all');
  }, [selectedId, filter, stores]);

  const mapLink = HAS_SUPABASE_CONFIG && selected ? kakaoMapLink(selected.name, selected.location.lat, selected.location.lng) : null;

  return <div className="rp-nearby">
    <KakaoMap stores={visibleStores} selectedId={selectedId} onSelect={onSelect} />
    <div className="rp-map-top">
      <div><span className="rp-location-icon"><Icon name="pin" /></span><div><strong>월계1동</strong><span>우리 동네에서 발견하기</span></div></div>
      <button type="button" onClick={onShowMap}>동네 지도 <Icon name="chevronRight" /></button>
    </div>
    <div className="rp-map-filters" aria-label="지도 가게 분류">{FILTERS.map((item) =>
      <button key={item.key} type="button" className={filter === item.key ? 'is-active' : ''} aria-pressed={filter === item.key} onClick={() => { setFilter(item.key); onSelect(null); }}>{item.label}</button>
    )}</div>
    {selected ? <div className="rp-map-bottom rp-selected-store" aria-live="polite">
      <div className="rp-selected-header"><span className="rp-selected-icon"><Icon name="storefront" /></span><div><small>선택한 동네 가게</small><strong>{selected.name}</strong></div><button type="button" onClick={() => onSelect(null)} aria-label="가게 선택 해제">×</button></div>
      <p>{selected.address}</p><p className="rp-selected-distance">월계1동 기준점에서 직선 {distanceLabel(selected)} · {HAS_SUPABASE_CONFIG ? '방문 전 영업 여부를 확인해 주세요' : '예시 위치'}</p>
      <div className="rp-selected-actions">
        {selected.supports['space-rental'] && <Link to="/space-rental">공간 소식 보기 <Icon name="chevronRight" /></Link>}
        {selected.supports['oneday-class'] && <Link to="/oneday-class">수업 소식 보기 <Icon name="chevronRight" /></Link>}
        {selected.supports['closing-sale'] && <Link to="/closing-sale">마감 할인 보기 <Icon name="chevronRight" /></Link>}
        {!selected.supports['space-rental'] && !selected.supports['oneday-class'] && !selected.supports['closing-sale'] && selected.supports['partner-stores'] && <Link to="/partner-stores">제휴 혜택 보기 <Icon name="chevronRight" /></Link>}
        {mapLink && <a href={mapLink} target="_blank" rel="noopener noreferrer">카카오맵에서 보기 <Icon name="chevronRight" /></a>}
      </div>
    </div> : <div className="rp-map-bottom rp-map-hint" role={loadState === 'error' ? 'alert' : 'status'}><Icon name="pin" /><span>
      {loadState === 'loading' ? '동네 가게를 불러오는 중이에요' : loadState === 'error' ? '가게 목록을 불러오지 못했어요' : visibleStores.length ? '가게 표시를 눌러 위치를 확인하세요' : '이 분류에 공개된 가게가 아직 없어요'}
      <small>{loadState === 'ready' ? HAS_SUPABASE_CONFIG ? `${visibleStores.length}곳의 공개된 가게` : `${visibleStores.length}곳의 예시 가게` : loadState === 'error' ? '연결 상태를 확인하고 다시 시도해 주세요' : '잠시만 기다려 주세요'}</small>
      {loadState === 'error' && <button type="button" onClick={() => { setLoadState('loading'); setRetry((n) => n + 1); }}>다시 시도</button>}
    </span></div>}
  </div>;
}
