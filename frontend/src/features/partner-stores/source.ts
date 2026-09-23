import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { walkMinutes } from '../../core/utils/geo';
import { MOCK_PARTNER_BENEFITS } from './mock';
import type { PartnerStoreView } from './types';

/**
 * 제휴 정보 목록을 가져오는 지점. 화면은 이 함수만 바라본다.
 * Supabase 연동 시 rows 를 가져오는 줄만 아래처럼 바꾸면 된다.
 *
 *   const { data: rows } = await supabase.from('partner_benefits').select('*');
 */
export async function fetchPartnerStores(): Promise<PartnerStoreView[]> {
  const rows = MOCK_PARTNER_BENEFITS;
  const [stores, here] = await Promise.all([fetchStoresByIds(rows.map((r) => r.storeId)), getUserLocation()]);
  return rows.flatMap((row) => {
    const store = stores.get(row.storeId);
    return store ? [{ ...row, store, walkMinutes: walkMinutes(here, store.location) }] : [];
  });
}
