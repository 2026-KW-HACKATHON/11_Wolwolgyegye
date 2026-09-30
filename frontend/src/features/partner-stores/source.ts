import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { distanceMeters, walkMinutes } from '../../core/utils/geo';
import { MOCK_PARTNER_BENEFITS, MOCK_PARTNER_STORE_MENU } from './mock';
import type { PartnerStoreView } from './types';

/**
 * 제휴 정보 목록을 가져오는 지점. 화면은 이 함수만 바라본다.
 * 실제 연동 시 단과대별 DB 행을 benefits/details로 묶고 출처·기간을 검증한다.
 * 현재 좌표와 가게, 연락처, 혜택 모두 예시이며 현재 사용자 위치가 아니다.
 */
export async function fetchPartnerStores(): Promise<PartnerStoreView[]> {
  const rows = MOCK_PARTNER_BENEFITS;
  const [stores, here] = await Promise.all([fetchStoresByIds(rows.map((r) => r.storeId)), getUserLocation()]);
  return rows.flatMap((row) => {
    const store = stores.get(row.storeId);
    return store ? [{
      ...row, store, walkMinutes: walkMinutes(here, store.location),
      referenceDistanceMeters: distanceMeters(here, store.location),
      menus: MOCK_PARTNER_STORE_MENU.filter((menu) => menu.storeId === row.storeId),
      dataMode: 'demo' as const,
      details: Object.fromEntries(Object.keys(row.benefits).map((key) => [key, { status: 'demo' as const }])),
    }] : [];
  });
}
