import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_STORES, MOCK_USER_LOCATION } from '../../core/mock/stores';
import { distanceMeters } from '../../core/utils/geo';
import type { Store } from '../../core/types/place';
import Icon from '../../shared/Icon';
import KakaoMap from './KakaoMap';

type MapFilter = 'all' | 'space-rental' | 'oneday-class' | 'closing-sale';
const FILTERS: { key: MapFilter; label: string }[] = [
  { key: 'all', label: '전체' }, { key: 'space-rental', label: '공간 대여' },
  { key: 'oneday-class', label: '원데이클래스' }, { key: 'closing-sale', label: '마감세일' },
];
const stores = MOCK_STORES.filter((store) => store.supports['space-rental'] || store.supports['oneday-class'] || store.supports['closing-sale'] || store.supports.coupon || store.supports['partner-stores']);

function distanceLabel(store: Store) {
  const meters = distanceMeters(MOCK_USER_LOCATION, store.location);
  return meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(meters / 1000).toFixed(1)}km`;
}

export default function NearbyScreen() {
  const [filter, setFilter] = useState<MapFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visibleStores = useMemo(() => stores.filter((store) => filter === 'all' || store.supports[filter]).sort((a, b) => distanceMeters(MOCK_USER_LOCATION, a.location) - distanceMeters(MOCK_USER_LOCATION, b.location)), [filter]);
  const selected = visibleStores.find((store) => store.id === selectedId);

  function setMapFilter(value: MapFilter) {
    setFilter(value);
    setSelectedId(null);
  }

  return <div className="rp-nearby">
    <div className="rp-map-intro"><span className="rp-map-handle" aria-hidden="true" /><p className="rp-eyebrow">EXPLORE THE NEIGHBORHOOD</p><h2>지도로 둘러보는 우리 동네</h2><p>월계1동 주변 가게를 한눈에 만나보세요.</p></div>
    <div className="rp-map-filters" aria-label="지도 가게 분류">{FILTERS.map((item) => <button key={item.key} type="button" className={filter === item.key ? 'is-active' : ''} aria-pressed={filter === item.key} onClick={() => setMapFilter(item.key)}>{item.label}</button>)}</div>
    <KakaoMap stores={visibleStores} selectedId={selectedId} onSelect={setSelectedId} />
    <p className="rp-map-caption">가게·좌표·거리는 시연용 예시입니다. 거리는 월계1동 기준점에서 직선거리예요.</p>
    {selected && <div className="rp-selected-store"><img src={selected.thumbnailUrl} alt="" loading="lazy" /><div><span>지도에서 선택한 가게</span><strong>{selected.name}</strong><small>{selected.address}</small></div><button type="button" onClick={() => setSelectedId(null)} aria-label="선택 해제">×</button></div>}
    <div className="rp-nearby-list-heading"><h3>가까운 가게 <span>{visibleStores.length}</span></h3><span>가까운 순</span></div>
    <ul className="rp-nearby-list">{visibleStores.map((store) => <li key={store.id}><button type="button" className={selectedId === store.id ? 'is-selected' : ''} onClick={() => setSelectedId(store.id)}><img src={store.thumbnailUrl} alt="" loading="lazy" /><span><strong>{store.name}</strong><small>{store.address}</small><em><Icon name="pin" /> {distanceLabel(store)} · {store.supports['space-rental'] ? '공간 대여' : store.supports['oneday-class'] ? '원데이클래스' : store.supports['closing-sale'] ? '마감세일' : '동네 가게'}</em></span><Icon name="chevronRight" /></button></li>)}</ul>
    <p className="rp-map-owner">동네 가게를 소개하고 싶나요? <Link to="/owner">사장님 페이지</Link></p>
  </div>;
}
