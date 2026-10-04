import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { distanceMeters, walkMinutes } from '../../core/utils/geo';
import type { PartnerBenefit, PartnerStoreMenuItem, PartnerStoreView } from './types';

/**
 * 제휴 정보 목록을 가져오는 지점. 화면은 이 함수만 바라본다.
 * TODO(DB): partner_benefits · benefit_partners · partners · store_menus 연결. 그 전까지는 빈 목록이다.
 * 실제 연동 시 단과대별 DB 행을 benefits/details로 묶고 출처·기간을 검증한다.
 */
async function fetchBenefitRows(): Promise<PartnerBenefit[]> {
  return [];
}

async function fetchMenuRows(): Promise<PartnerStoreMenuItem[]> {
  return [];
}

export async function fetchPartnerStores(): Promise<PartnerStoreView[]> {
  const [rows, menus] = await Promise.all([fetchBenefitRows(), fetchMenuRows()]);
  const [stores, here] = await Promise.all([fetchStoresByIds(rows.map((r) => r.storeId)), getUserLocation()]);
  return rows.flatMap((row) => {
    const store = stores.get(row.storeId);
    return store ? [{
      ...row, store, walkMinutes: walkMinutes(here, store.location),
      referenceDistanceMeters: distanceMeters(here, store.location),
      menus: menus.filter((menu) => menu.storeId === row.storeId),
      dataMode: 'demo' as const,
      details: Object.fromEntries(Object.keys(row.benefits).map((key) => [key, { status: 'demo' as const }])),
    }] : [];
  });
}
