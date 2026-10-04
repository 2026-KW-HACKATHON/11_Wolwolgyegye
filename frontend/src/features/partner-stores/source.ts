import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { getSupabaseClient } from '../../core/supabase/client';
import { distanceMeters, walkMinutes } from '../../core/utils/geo';
import type { CollegeKey, PartnerBenefit, PartnerStoreMenuItem, PartnerStoreView } from './types';

/**
 * 제휴 정보 목록을 가져오는 지점. 화면은 이 함수만 바라본다.
 * 단과대별 DB 행을 가게별로 묶고 공개 가게의 메뉴와 함께 반환한다.
 */
export async function fetchPartnerStores(): Promise<PartnerStoreView[]> {
  const client = getSupabaseClient();
  const benefitsResult = await client.from('partner_benefits').select('store_id, college_key, benefit, condition');
  if (benefitsResult.error) throw new Error('제휴 혜택을 불러오지 못했어요.');
  const grouped = new Map<string, PartnerBenefit>();
  for (const row of benefitsResult.data ?? []) {
    const current: PartnerBenefit = grouped.get(row.store_id) ?? {
      storeId: row.store_id,
      benefits: {} as Partial<Record<CollegeKey, string>>,
      condition: row.condition,
      details: {},
    };
    const college = row.college_key as CollegeKey;
    current.benefits[college] = row.benefit;
    current.details![college] = { status: 'verified', condition: row.condition };
    grouped.set(row.store_id, current);
  }
  const rows = [...grouped.values()];
  const ids = rows.map((row) => row.storeId);
  const [stores, here, menusResult] = await Promise.all([
    fetchStoresByIds(ids), getUserLocation(),
    ids.length ? client.from('store_menus').select('id, store_id, name, price').in('store_id', ids).eq('is_available', true) : Promise.resolve({ data: [], error: null }),
  ]);
  if (menusResult.error) throw new Error('제휴 가게 메뉴를 불러오지 못했어요.');
  const menus = (menusResult.data ?? []).map((row): PartnerStoreMenuItem => ({
    id: row.id, storeId: row.store_id, name: row.name, price: row.price,
  }));
  return rows.flatMap((row) => {
    const store = stores.get(row.storeId);
    return store ? [{
      ...row, store, walkMinutes: walkMinutes(here, store.location),
      referenceDistanceMeters: distanceMeters(here, store.location),
      menus: menus.filter((menu) => menu.storeId === row.storeId),
      dataMode: 'live' as const,
    }] : [];
  });
}
