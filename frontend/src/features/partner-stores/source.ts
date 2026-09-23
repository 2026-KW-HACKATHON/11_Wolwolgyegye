import { fetchStoresByIds } from '../../core/source/storeSource';
import type { Store } from '../../core/types/place';
import { MOCK_PARTNER_STORE_INFOS } from './mock';
import type { PartnerStoreInfo } from './types';

/** 화면이 받는 모양: 제휴 정보 + 가게 공통 정보 */
export type PartnerStoreInfoView = PartnerStoreInfo & { store: Store };

/**
 * 제휴 정보 목록을 가져오는 지점. 화면은 이 함수만 바라본다.
 * Supabase 연동 시 rows 를 가져오는 줄만 아래처럼 바꾸면 된다.
 *
 *   const { data: rows } = await supabase.from('partner_store_infos').select('*');
 */
export async function fetchPartnerStores(): Promise<PartnerStoreInfoView[]> {
  const rows = MOCK_PARTNER_STORE_INFOS;
  const stores = await fetchStoresByIds(rows.map((r) => r.storeId));
  return rows.flatMap((row) => {
    const store = stores.get(row.storeId);
    return store ? [{ ...row, store }] : [];
  });
}
