import { forgetStores } from '../../core/source/storeSource';
import type { MenuKind } from '../../core/source/storeDetail';
import { getSupabaseClient } from '../../core/supabase/client';
import type { HoursRow } from '../../core/utils/hours';

/**
 * 사장님 화면의 읽기·쓰기. 모두 RLS 로 "내 가게(stores.owner_id = 나)" 행만 바뀐다.
 * - 마감세일: closing_sales (등록·종료·삭제)
 * - 가게 정보: stores 의 name·type_id·industry·phone (이 네 칸만 사장님 수정 권한이 있다), store_hours, store_menus
 * 저장한 뒤에는 손님 화면이 기억해 둔 가게 정보를 지워 다음에 새로 읽게 한다.
 */

// ---------- 마감세일 ----------

export type SaleDiscountType = 'amount' | 'rate' | 'free';

export interface OwnerSale {
  id: string;
  discountType: SaleDiscountType;
  discountAmount: number | null;
  /** 0 ~ 1 (0.3 = 30%) */
  discountRate: number | null;
  offer: string;
  condition: string;
  startsAt: string;
  endsAt: string;
}

export interface SaleInput {
  discountType: SaleDiscountType;
  discountAmount: number | null;
  discountRate: number | null;
  offer: string;
  condition: string;
  startsAt: string;
  endsAt: string;
}

interface SaleRow {
  id: string; discount_type: SaleDiscountType; discount_amount: number | null; discount_rate: number | string | null;
  offer: string; condition: string; starts_at: string; ends_at: string;
}

/** DB closing_sales 의 check 제약을 그대로 옮긴 검사. 문제가 없으면 null */
export function validateSale(input: SaleInput): string | null {
  if (input.condition.length > 500 || input.offer.length > 500) return '제공 내용과 조건은 500자 이내로 입력해 주세요.';
  if (input.discountType === 'amount' && !(Number.isInteger(input.discountAmount) && input.discountAmount! >= 1 && input.discountAmount! <= 10_000_000)) {
    return '할인 금액은 1원 ~ 10,000,000원 사이로 입력해 주세요.';
  }
  if (input.discountType === 'rate' && !(input.discountRate !== null && input.discountRate > 0 && input.discountRate <= 1)) {
    return '할인율은 1% ~ 100% 사이로 입력해 주세요.';
  }
  if (input.discountType === 'free' && !input.offer.trim()) return '무료 제공은 제공 내용을 꼭 적어 주세요.';
  const starts = Date.parse(input.startsAt);
  const ends = Date.parse(input.endsAt);
  if (!Number.isFinite(starts) || !Number.isFinite(ends)) return '세일 시작·끝 시각을 입력해 주세요.';
  if (ends <= starts) return '끝나는 시각은 시작 시각보다 뒤여야 해요.';
  if (ends <= Date.now()) return '이미 지난 시각으로는 등록할 수 없어요.';
  return null;
}

/** 내 가게의 진행 중·예정 세일 (끝난 세일은 빼고, 시작 순) */
export async function fetchOwnerSales(storeId: string): Promise<OwnerSale[]> {
  const { data, error } = await getSupabaseClient().from('closing_sales')
    .select('id, discount_type, discount_amount, discount_rate, offer, condition, starts_at, ends_at')
    .eq('store_id', storeId).gt('ends_at', new Date().toISOString()).order('starts_at');
  if (error) throw new Error('마감세일을 불러오지 못했어요.');
  return ((data ?? []) as SaleRow[]).map((row) => ({
    id: row.id, discountType: row.discount_type, discountAmount: row.discount_amount,
    // numeric 칸은 문자열로 올 수 있다
    discountRate: row.discount_rate === null ? null : Number(row.discount_rate),
    offer: row.offer, condition: row.condition, startsAt: row.starts_at, endsAt: row.ends_at,
  }));
}

export async function createSale(storeId: string, input: SaleInput): Promise<void> {
  const problem = validateSale(input);
  if (problem) throw new Error(problem);
  const { error } = await getSupabaseClient().from('closing_sales').insert({
    store_id: storeId,
    discount_type: input.discountType,
    discount_amount: input.discountType === 'amount' ? input.discountAmount : null,
    discount_rate: input.discountType === 'rate' ? input.discountRate : null,
    offer: input.offer.trim(),
    condition: input.condition.trim(),
    starts_at: new Date(input.startsAt).toISOString(),
    ends_at: new Date(input.endsAt).toISOString(),
  });
  if (error) throw new Error('마감세일을 등록하지 못했어요. 입력 내용을 확인해 주세요.');
  forgetStores();
}

/** 진행 중인 세일을 지금 끝낸다 (ends_at = 지금). 아직 시작 전인 세일은 deleteSale 로 지운다 */
export async function endSale(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('closing_sales').update({ ends_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error('세일을 종료하지 못했어요.');
  forgetStores();
}

export async function deleteSale(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('closing_sales').delete().eq('id', id);
  if (error) throw new Error('세일을 삭제하지 못했어요.');
  forgetStores();
}

// ---------- 가게 정보 ----------

export interface OwnerStoreBasics {
  name: string;
  typeId: string | null;
  industry: string;
  phone: string;
}

export interface OwnerMenu {
  id: string;
  name: string;
  price: number;
  section: string;
  kind: MenuKind | null;
  description: string;
  sortOrder: number;
}

export type MenuInput = Omit<OwnerMenu, 'id'>;

export interface OwnerStoreInfo {
  basics: OwnerStoreBasics;
  /** 요일 0(일) ~ 6(토) 모두. DB 에 없는 요일은 휴무로 채운다 */
  hours: HoursRow[];
  menus: OwnerMenu[];
}

interface InfoRow {
  name: string; type_id: string | null; industry: string; phone: string;
  store_hours: HoursRow[];
  store_menus: { id: string; name: string; price: number; section: string; kind: MenuKind | null; description: string; sort_order: number }[];
}

export async function fetchOwnerStoreInfo(storeId: string): Promise<OwnerStoreInfo> {
  const { data, error } = await getSupabaseClient().from('stores')
    .select('name, type_id, industry, phone, store_hours(weekday, opens_at, closes_at, is_closed), store_menus(id, name, price, section, kind, description, sort_order)')
    .eq('id', storeId).single();
  if (error || !data) throw new Error('가게 정보를 불러오지 못했어요.');
  const row = data as unknown as InfoRow;
  const hours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => row.store_hours.find((h) => h.weekday === weekday)
    ?? { weekday, opens_at: null, closes_at: null, is_closed: true });
  return {
    basics: { name: row.name, typeId: row.type_id, industry: row.industry, phone: row.phone },
    hours,
    menus: [...row.store_menus].sort((a, b) => a.sort_order - b.sort_order).map((m) => ({
      id: m.id, name: m.name, price: m.price, section: m.section, kind: m.kind, description: m.description, sortOrder: m.sort_order,
    })),
  };
}

export async function saveStoreBasics(storeId: string, basics: OwnerStoreBasics): Promise<void> {
  const name = basics.name.trim();
  if (!name) throw new Error('가게 이름을 입력해 주세요.');
  const { error } = await getSupabaseClient().from('stores').update({
    name, type_id: basics.typeId, industry: basics.industry.trim(), phone: basics.phone.trim(),
  }).eq('id', storeId);
  if (error) throw new Error('가게 정보를 저장하지 못했어요.');
  forgetStores();
}

/** DB store_hours check: 휴무가 아니면 여는·닫는 시각이 모두 있고 서로 달라야 한다 */
export function validateHours(hours: HoursRow[]): string | null {
  const bad = hours.find((h) => !h.is_closed && (!h.opens_at || !h.closes_at || h.opens_at === h.closes_at));
  return bad ? '영업하는 요일은 여는 시각과 닫는 시각을 다르게 입력해 주세요.' : null;
}

export async function saveStoreHours(storeId: string, hours: HoursRow[]): Promise<void> {
  const problem = validateHours(hours);
  if (problem) throw new Error(problem);
  const { error } = await getSupabaseClient().from('store_hours').upsert(
    hours.map((h) => ({
      store_id: storeId, weekday: h.weekday, is_closed: h.is_closed,
      opens_at: h.is_closed ? null : h.opens_at, closes_at: h.is_closed ? null : h.closes_at,
    })),
    { onConflict: 'store_id,weekday' },
  );
  if (error) throw new Error('영업시간을 저장하지 못했어요.');
  forgetStores();
}

/** DB store_menus check 와 같은 검사 */
export function validateMenu(input: MenuInput): string | null {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 100) return '메뉴 이름은 1~100자로 입력해 주세요.';
  if (!Number.isInteger(input.price) || input.price < 0 || input.price > 10_000_000) return '가격은 0원 ~ 10,000,000원 사이로 입력해 주세요.';
  if (input.section.length > 200) return '메뉴판 묶음 이름은 200자 이내로 입력해 주세요.';
  if (input.description.length > 300) return '설명은 300자 이내로 입력해 주세요.';
  return null;
}

function menuPayload(input: MenuInput) {
  return {
    name: input.name.trim(), price: input.price, section: input.section.trim(), kind: input.kind,
    description: input.description.trim(), sort_order: input.sortOrder,
  };
}

export async function saveMenu(storeId: string, input: MenuInput, id?: string): Promise<void> {
  const problem = validateMenu(input);
  if (problem) throw new Error(problem);
  const client = getSupabaseClient();
  const { error } = id
    ? await client.from('store_menus').update(menuPayload(input)).eq('id', id)
    : await client.from('store_menus').insert({ store_id: storeId, ...menuPayload(input) });
  if (error) throw new Error('메뉴를 저장하지 못했어요.');
  forgetStores();
}

export async function deleteMenu(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('store_menus').delete().eq('id', id);
  if (error) throw new Error('메뉴를 삭제하지 못했어요.');
  forgetStores();
}
