import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { walkMinutes } from '../../core/utils/geo';
import type { ClosingSale, ClosingSaleView } from './types';

/**
 * 손님 화면에 보여줄 마감세일을 가져오는 지점.
 * TODO(DB): closing_sales 테이블 연결. 그 전까지는 빈 목록이다. (가짜 데이터를 쓰지 않는다)
 */
async function fetchSaleRows(): Promise<ClosingSale[]> {
  return [];
}

/** 세일 목록에 가게 정보와 도보 시간을 붙여 돌려준다. 가게 정보가 없는 세일은 뺀다 */
export async function fetchClosingSales(): Promise<ClosingSaleView[]> {
  const [rows, here] = await Promise.all([fetchSaleRows(), getUserLocation()]);
  const stores = await fetchStoresByIds(rows.map((r) => r.storeId));

  return rows.flatMap((row) => {
    const store = stores.get(row.storeId);
    return store ? [{ ...row, store, walkMinutes: walkMinutes(here, store.location) }] : [];
  });
}
