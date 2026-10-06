import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { getSupabaseClient } from '../../core/supabase/client';
import { walkMinutes } from '../../core/utils/geo';
import type { ClosingSale, ClosingSaleView } from './types';

interface SaleRow {
  id: string;
  store_id: string;
  discount_type: ClosingSale['discountType'];
  discount_amount: number | null;
  discount_rate: number | string | null;
  condition: string;
  offer: string;
  starts_at: string;
  ends_at: string;
}

/** 손님 화면에 보여줄 마감세일: DB closing_sales 중 아직 끝나지 않은 것 (공개 가게만, RLS). 못 읽으면 오류를 던진다 (빈 목록과 구분) */
async function fetchSaleRows(): Promise<ClosingSale[]> {
  const { data, error } = await getSupabaseClient().from('closing_sales')
    .select('id, store_id, discount_type, discount_amount, discount_rate, condition, offer, starts_at, ends_at')
    .gt('ends_at', new Date().toISOString())
    .order('ends_at');
  if (error) throw new Error('마감세일을 불러오지 못했어요.');
  const rows = (data ?? []) as SaleRow[];
  const { data: counts, error: countError } = await getSupabaseClient().rpc('get_sale_like_counts', { p_sale_ids: rows.map((row) => row.id) });
  if (countError) throw new Error('마감세일을 불러오지 못했어요.');
  const likeCounts = new Map<string, number>(((counts ?? []) as { sale_id: string; like_count: number | string }[])
    .map((row) => [row.sale_id, Number(row.like_count)]));
  return rows.map((row) => ({
    id: row.id,
    storeId: row.store_id,
    discountType: row.discount_type,
    discountAmount: row.discount_amount,
    // numeric 칸은 문자열로 올 수 있다
    discountRate: row.discount_rate === null ? null : Number(row.discount_rate),
    offer: row.offer,
    condition: row.condition,
    desc: [row.offer, row.condition].filter(Boolean).join(' · '),
    startsAt: row.starts_at,
    closeAt: row.ends_at,
    likeCount: likeCounts.get(row.id) ?? 0,
  }));
}

/** 세일 목록에 가게 정보와 도보 시간을 붙여 돌려준다. 가게 정보가 없는 세일은 뺀다. 세일을 못 읽으면 오류를 던진다 */
export async function fetchClosingSales(): Promise<ClosingSaleView[]> {
  const [rows, here] = await Promise.all([fetchSaleRows(), getUserLocation()]);
  const stores = await fetchStoresByIds(rows.map((r) => r.storeId));

  return rows.flatMap((row) => {
    const store = stores.get(row.storeId);
    return store ? [{ ...row, store, walkMinutes: walkMinutes(here, store.location) }] : [];
  });
}
