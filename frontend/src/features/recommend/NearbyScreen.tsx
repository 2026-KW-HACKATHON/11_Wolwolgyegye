import { useMemo, useState } from 'react';
import { MOCK_STORES, MOCK_USER_LOCATION } from '../../core/mock/stores';
import type { Store } from '../../core/types/place';
import { distanceMeters } from '../../core/utils/geo';
import Icon from '../../shared/Icon';
import KakaoMap from './KakaoMap';

type MapFilter = 'all' | 'space-rental' | 'oneday-class' | 'closing-sale';
const FILTERS: { key: MapFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'space-rental', label: '공간 대여' },
  { key: 'oneday-class', label: '원데이클래스' },
  { key: 'closing-sale', label: '마감세일' },
];
const stores = MOCK_STORES.filter((store) =>
  store.supports['space-rental'] || store.supports['oneday-class'] ||
  store.supports['closing-sale'] || store.supports.coupon || store.supports['partner-stores']);

function distanceLabel(store: Store) {
  const meters = distanceMeters(MOCK_USER_LOCATION, store.location);
  return meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(meters / 1000).toFixed(1)}km`;
}

export default function NearbyScreen() {
  const [filter, setFilter] = useState<MapFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visibleStores = useMemo(() => stores.filter((store) => filter === 'all' || store.supports[filter]), [filter]);
  const selected = visibleStores.find((store) => store.id === selectedId);

  function chooseFilter(next: MapFilter) {
    setFilter(next);
    setSelectedId(null);
  }

  return <div className="rp-nearby">
    <KakaoMap stores={visibleStores} selectedId={selectedId} onSelect={setSelectedId} />
    <div className="rp-map-top">
      <span><Icon name="pin" /> 월계1동 기준</span>
      <strong>우리 동네 지도</strong>
      <small>가게 위치와 거리는 시연용 예시입니다.</small>
    </div>
    <div className="rp-map-filters" aria-label="지도 가게 분류">
      {FILTERS.map((item) => <button key={item.key} type="button" className={filter === item.key ? 'is-active' : ''} aria-pressed={filter === item.key} onClick={() => chooseFilter(item.key)}>{item.label}</button>)}
    </div>
    {selected ? <div className="rp-map-bottom rp-selected-store">
      <img src={selected.thumbnailUrl} alt="" loading="lazy" />
      <div><span>지도에서 선택한 가게 · {distanceLabel(selected)}</span><strong>{selected.name}</strong><small>{selected.address}</small></div>
      <button type="button" onClick={() => setSelectedId(null)} aria-label="선택 해제">×</button>
    </div> : <p className="rp-map-bottom rp-map-hint">지도 핀을 누르면 가게 정보가 보여요 · {visibleStores.length}곳</p>}
  </div>;
}
