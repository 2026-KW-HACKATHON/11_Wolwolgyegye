import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { getSupabaseClient } from '../../core/supabase/client';
import { walkMinutes } from '../../core/utils/geo';
import type { ClosingSale, ClosingSaleView } from './types';

/**
 * 손님 화면에 보여줄 마감세일을 가져오는 지점.
 *
 * 공개 중이고 아직 마감되지 않은 DB 행만 가져온다.
 */
async function fetchSaleRows(): Promise<ClosingSale[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.from('closing_sales')
    .select('id, store_id, description, discount_rate, close_at')
    .eq('is_published', true)
    .gt('close_at', new Date().toISOString())
    .order('close_at');
  if (error) throw new Error('마감세일을 불러오지 못했어요.');
  const ids = (data ?? []).map((row) => row.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const result = await client.rpc('get_sale_like_counts', { p_sale_ids: ids });
    if (!result.error) for (const row of result.data ?? []) counts.set(row.sale_id, Number(row.like_count));
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    storeId: row.store_id,
    desc: row.description,
    discountRate: Number(row.discount_rate),
    closeAt: row.close_at,
    likeCount: counts.get(row.id) ?? 0,
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
