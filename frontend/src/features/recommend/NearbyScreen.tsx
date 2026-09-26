import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_STORES, MOCK_USER_LOCATION } from '../../core/mock/stores';
import type { Store } from '../../core/types/place';
import { distanceMeters } from '../../core/utils/geo';
import Icon from '../../shared/Icon';
import KakaoMap from './KakaoMap';

type MapFilter = 'all' | 'space-rental' | 'oneday-class' | 'closing-sale';
const FILTERS: { key: MapFilter; label: string }[] = [
  { key: 'all', label: '전체 가게' }, { key: 'space-rental', label: '공간 대여' },
  { key: 'oneday-class', label: '원데이클래스' }, { key: 'closing-sale', label: '마감 할인' },
];
const stores = MOCK_STORES.filter((store) =>
  store.supports['space-rental'] || store.supports['oneday-class'] ||
  store.supports['closing-sale'] || store.supports.coupon || store.supports['partner-stores']);

function distanceLabel(store: Store) {
  const meters = distanceMeters(MOCK_USER_LOCATION, store.location);
  return meters < 1000 ? Math.round(meters / 10) * 10 + 'm' : (meters / 1000).toFixed(1) + 'km';
}

export default function NearbyScreen({ selectedId, onSelect, onShowMap }: {
  selectedId: string | null; onSelect: (id: string | null) => void; onShowMap: () => void;
}) {
  const [filter, setFilter] = useState<MapFilter>('all');
  const visibleStores = useMemo(() => stores.filter((store) => filter === 'all' || store.supports[filter]), [filter]);
  const selected = visibleStores.find((store) => store.id === selectedId);
  useEffect(() => {
    // 피드에서 선택한 가게가 현재 분류 밖일 때만 전체로 돌아간다.
    if (selectedId && filter !== 'all' && !stores.find((store) => store.id === selectedId)?.supports[filter]) setFilter('all');
  }, [selectedId, filter]);

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
      <p>{selected.address}</p><p className="rp-selected-distance">월계1동 기준점에서 직선 {distanceLabel(selected)} · 예시 위치</p>
      <div className="rp-selected-actions">
        {selected.supports['space-rental'] && <Link to="/space-rental">공간 소식 보기 <Icon name="chevronRight" /></Link>}
        {selected.supports['oneday-class'] && <Link to="/oneday-class">수업 소식 보기 <Icon name="chevronRight" /></Link>}
        {!selected.supports['space-rental'] && !selected.supports['oneday-class'] && <Link to={selected.supports['closing-sale'] ? '/closing-sale' : '/partner-stores'}>가게 혜택 보기 <Icon name="chevronRight" /></Link>}
      </div>
    </div> : <p className="rp-map-bottom rp-map-hint"><Icon name="pin" /><span>가게 표시를 눌러 소식을 확인하세요<small>{visibleStores.length}곳의 예시 가게가 있어요</small></span></p>}
  </div>;
}
