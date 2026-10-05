import { getSupabaseClient } from '../supabase/client';
import type { HoursRow } from '../utils/hours';

/**
 * 2차 탭(가게 화면)에 보여줄 가게 한 곳의 모든 정보.
 * stores 한 행과 거기 딸린 표(메뉴·영업시간·마감세일·제휴·공간대여·원데이클래스·스탬프)를 한 번에 읽는다.
 * 공개 가게만 읽힌다 (RLS). 없거나 연결에 실패하면 null.
 */
export interface StoreDetail {
  id: string;
  name: string;
  address: string;
  isMock: boolean;
  phone: string;
  hours: HoursRow[];
  menus: { id: string; name: string; price: number; typeId: string | null }[];
  sales: {
    id: string;
    discountType: 'amount' | 'rate' | 'free';
    discountAmount: number | null;
    discountRate: number | null;
    condition: string;
    offer: string;
    endsAt: string;
  }[];
  benefits: { id: string; discountAmount: number | null; discountRate: number | null; condition: string; partners: string[] }[];
  spaceRentals: { id: string; title: string; summary: string; category: string; price: number; capacity: number; minHours: number | null; availableHours: string }[];
  classes: { id: string; title: string; summary: string; category: string; startsAt: string; durationMinutes: number; price: number; currentCount: number; maxCount: number }[];
  stamp: { requiredStamps: number; reward: string; unit: string; condition: string } | null;
}

const COLUMNS = [
  'id, name, address, is_mock, phone',
  'store_hours(weekday, opens_at, closes_at, is_closed)',
  'store_menus(id, name, price, type_id, sort_order)',
  'closing_sales(id, discount_type, discount_amount, discount_rate, condition, offer, ends_at)',
  'partner_benefits(id, discount_amount, discount_rate, condition, benefit_partners(partners(name)))',
  'space_rentals(id, title, summary, price, capacity, min_hours, available_hours, created_at, space_rental_categories(name))',
  'one_day_classes(id, title, summary, starts_at, duration_minutes, price, current_count, max_count, one_day_class_categories(name))',
  'stamp_policies(required_stamps, reward, unit, condition)',
].join(', ');

/** DB 응답 한 행. 모양은 아래 fetchStoreDetail 에서 바로 바꾼다 */
type Row = Record<string, any>;
const list = (v: unknown): Row[] => (Array.isArray(v) ? v : v ? [v as Row] : []);
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function fetchStoreDetail(id: string): Promise<StoreDetail | null> {
  try {
    const { data, error } = await getSupabaseClient().from('stores').select(COLUMNS).eq('id', id).maybeSingle();
    if (error || !data) return null;
    const row = data as Row;
    const now = Date.now();
    const stamp = list(row.stamp_policies)[0];
    return {
      id: row.id,
      name: row.name ?? '',
      address: row.address ?? '',
      isMock: Boolean(row.is_mock),
      phone: row.phone ?? '',
      hours: list(row.store_hours) as HoursRow[],
      menus: list(row.store_menus)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => ({ id: m.id, name: m.name, price: m.price, typeId: m.type_id })),
      sales: list(row.closing_sales)
        .filter((s) => Date.parse(s.ends_at) > now)
        .sort((a, b) => a.ends_at.localeCompare(b.ends_at))
        .map((s) => ({
          id: s.id, discountType: s.discount_type, discountAmount: s.discount_amount, discountRate: num(s.discount_rate),
          condition: s.condition, offer: s.offer, endsAt: s.ends_at,
        })),
      benefits: list(row.partner_benefits).map((b) => ({
        id: b.id, discountAmount: b.discount_amount, discountRate: num(b.discount_rate), condition: b.condition,
        partners: list(b.benefit_partners).map((l) => l.partners?.name).filter(Boolean),
      })),
      spaceRentals: list(row.space_rentals)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r) => ({
          id: r.id, title: r.title, summary: r.summary, category: r.space_rental_categories?.name ?? '', price: r.price,
          capacity: r.capacity, minHours: r.min_hours, availableHours: r.available_hours,
        })),
      classes: list(row.one_day_classes)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .map((c) => ({
          id: c.id, title: c.title, summary: c.summary, category: c.one_day_class_categories?.name ?? '', startsAt: c.starts_at,
          durationMinutes: c.duration_minutes, price: c.price, currentCount: c.current_count, maxCount: c.max_count,
        })),
      stamp: stamp ? { requiredStamps: stamp.required_stamps, reward: stamp.reward, unit: stamp.unit, condition: stamp.condition } : null,
    };
  } catch {
    return null;
  }
}
