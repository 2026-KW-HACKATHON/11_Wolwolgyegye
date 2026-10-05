import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { getSupabaseClient } from '../../core/supabase/client';
import { distanceMeters } from '../../core/utils/geo';
import { COLLEGES } from './colleges';
import type { CollegeKey, PartnerBenefit, PartnerStoreMenuItem, PartnerStoreView } from './types';

/**
 * 제휴 정보 목록을 가져오는 지점. 화면은 이 함수만 바라본다.
 * DB: partner_benefits(혜택) — benefit_partners — partners(제휴사 = 단과대학 정식 명칭), 메뉴는 store_menus.
 * 혜택 행들을 가게별로 묶어 단과대별 혜택 문구로 바꾼다.
 */
interface BenefitRow {
  id: string;
  store_id: string;
  discount_amount: number | null;
  discount_rate: number | string | null;
  condition: string;
  benefit_partners: { partners: { name: string } | null }[];
}

type Discount = { type: 'amount' | 'percent'; value: number };

const collegeByName = new Map(COLLEGES.map((c) => [c.name, c.key]));

/** 한 혜택 행의 할인. DB 는 비율과 금액을 함께 둘 수 있어서 둘 다 돌려준다 (비율 먼저) */
function discountsOf(row: BenefitRow): Discount[] {
  const list: Discount[] = [];
  // numeric 칸은 문자열로 올 수 있다
  if (row.discount_rate !== null) list.push({ type: 'percent', value: Math.round(Number(row.discount_rate) * 100) });
  if (row.discount_amount !== null) list.push({ type: 'amount', value: row.discount_amount });
  return list;
}
const discountText = (list: Discount[]) =>
  list.map((d) => (d.type === 'percent' ? `${d.value}%` : `${d.value.toLocaleString('ko-KR')}원`)).join(' + ') + ' 할인';

/** 가게별 혜택 + 가게별·단과대별 할인 (메뉴 할인 계산용) */
async function fetchBenefitRows(): Promise<{ benefits: PartnerBenefit[]; discounts: Map<string, Partial<Record<CollegeKey, Discount>>> }> {
  const byStore = new Map<string, PartnerBenefit>();
  const discounts = new Map<string, Partial<Record<CollegeKey, Discount>>>();
  try {
    const { data, error } = await getSupabaseClient().from('partner_benefits')
      .select('id, store_id, discount_amount, discount_rate, condition, benefit_partners(partners(name))');
    if (error) throw error;
    for (const row of (data ?? []) as unknown as BenefitRow[]) {
      const rowDiscounts = discountsOf(row);
      if (!rowDiscounts.length) continue;
      const benefit = byStore.get(row.store_id) ?? { storeId: row.store_id, benefits: {}, condition: '' };
      const storeDiscounts = discounts.get(row.store_id) ?? {};
      for (const link of row.benefit_partners ?? []) {
        const key = link.partners ? collegeByName.get(link.partners.name) : undefined;
        if (!key) continue;
        const text = discountText(rowDiscounts);
        benefit.benefits[key] = benefit.benefits[key] ? `${benefit.benefits[key]} / ${text}` : text;
        // 메뉴 할인가 계산은 한 가지 할인만 쓴다
        storeDiscounts[key] ??= rowDiscounts[0];
      }
      if (row.condition && !benefit.condition.split(' · ').includes(row.condition)) {
        benefit.condition = benefit.condition ? `${benefit.condition} · ${row.condition}` : row.condition;
      }
      byStore.set(row.store_id, benefit);
      discounts.set(row.store_id, storeDiscounts);
    }
  } catch {
    return { benefits: [], discounts };
  }
  return { benefits: [...byStore.values()].filter((b) => Object.keys(b.benefits).length > 0), discounts };
}

async function fetchMenuRows(storeIds: string[], discounts: Map<string, Partial<Record<CollegeKey, Discount>>>): Promise<PartnerStoreMenuItem[]> {
  if (!storeIds.length) return [];
  try {
    const { data, error } = await getSupabaseClient().from('store_menus')
      .select('id, store_id, name, price, sort_order').in('store_id', storeIds).order('sort_order');
    if (error) throw error;
    return ((data ?? []) as { id: string; store_id: string; name: string; price: number }[]).map((m) => ({
      id: m.id, storeId: m.store_id, name: m.name, price: m.price, discounts: discounts.get(m.store_id),
    }));
  } catch {
    return [];
  }
}

export async function fetchPartnerStores(): Promise<PartnerStoreView[]> {
  const { benefits: rows, discounts } = await fetchBenefitRows();
  const ids = rows.map((r) => r.storeId);
  const [menus, stores, here] = await Promise.all([fetchMenuRows(ids, discounts), fetchStoresByIds(ids), getUserLocation()]);
  return rows.flatMap((row) => {
    const store = stores.get(row.storeId);
    if (!store) return [];
    return [{
      ...row, store,
      referenceDistanceMeters: distanceMeters(here, store.location),
      menus: menus.filter((menu) => menu.storeId === row.storeId),
      dataMode: store.isMock ? 'demo' as const : 'live' as const,
    }];
  });
}
