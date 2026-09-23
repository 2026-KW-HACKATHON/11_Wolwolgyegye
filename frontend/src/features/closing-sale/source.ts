import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { walkMinutes } from '../../core/utils/geo';
import { MOCK_CLOSING_SALES } from './mock';
import type { ClosingSale, ClosingSaleView } from './types';

/**
 * 손님 화면에 보여줄 마감세일을 가져오는 지점.
 *
 * 지금은 예시 데이터를 "지금 기준 마감 시각"으로 바꿔서 쓰지만, 백엔드가 준비되면
 * fetchSaleRows 안만 아래처럼 바꾸면 화면 코드는 그대로 둬도 된다.
 *
 *   const { data } = await supabase.from('closing_sales').select('*');
 *   return data;
 */
async function fetchSaleRows(): Promise<ClosingSale[]> {
  const now = Date.now();
  return MOCK_CLOSING_SALES.map(({ closesInMinutes, ...sale }) => ({
    ...sale,
    closeAt: new Date(now + closesInMinutes * 60_000).toISOString(),
  }));
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
