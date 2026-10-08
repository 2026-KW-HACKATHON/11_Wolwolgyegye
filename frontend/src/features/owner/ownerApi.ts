import { forgetStores } from '../../core/source/storeSource';
import { FEED_CHANGE_EVENT } from '../store-feed/feedSource';
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

/** 진행 중인 세일을 지금 끝낸다 (ends_at = 지금). 기록까지 지우려면 deleteSale */
export async function endSale(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('closing_sales').update({ ends_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error('세일을 종료하지 못했어요.');
  forgetStores();
}

/** 세일을 지운다. 손님 화면에서 바로 사라지고, 손님들이 누른 찜(sale_likes)도 함께 지워진다 */
export async function deleteSale(id: string): Promise<void> {
  const { data, error } = await getSupabaseClient().from('closing_sales').delete().eq('id', id).select('id');
  if (error || !data?.length) throw new Error('세일을 삭제하지 못했어요.');
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

// ---------- 사장님 센터: 현황과 운영 중인 소식 ----------

export type OwnerNewsKind = 'space-rental' | 'oneday-class' | 'closing-sale' | 'coupon';

/** 운영 중인 소식 한 줄 (공간대여·클래스 글, 마감세일, 스탬프 규칙을 같은 모양으로) */
export interface OwnerNews {
  id: string;
  kind: OwnerNewsKind;
  title: string;
  /** 일정 한 줄 (예: 5월 20일 (화) 14:00 - 17:00) */
  when: string;
  status: { label: string; tone: 'on' | 'soon' | 'off' };
  /** 최신순 정렬 기준 */
  createdAt: string;
  /** 일정순 정렬 기준 (없으면 만든 시각) */
  sortAt: string;
  /** 공간대여·클래스 글이면 상세 정보 (카드를 누르면 보여 준다) */
  post?: OwnerPostDetail;
}

/** 공간대여·클래스 글의 상세 (사장님 센터 > 운영 중인 소식 > 카드) */
export interface OwnerPostDetail {
  category: string;
  summary: string;
  /** 공간은 시간당, 클래스는 1인당 */
  price: number;
  /** 공간은 최대 이용 인원, 클래스는 정원 */
  capacity: number;
  /** 공간만: 최소 이용 시간 */
  minHours: number | null;
  /** 클래스만: 지금까지 신청한 인원. 공간 대여는 신청을 기록하는 곳이 없어 null */
  applied: number | null;
  cancelledAt: string | null;
  cancelReason: string;
}

export interface OwnerDashboard {
  news: OwnerNews[];
}

const dayFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
const timeFormat = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
/** 5월 20일 (화) */
const day = (date: Date) => dayFormat.format(date);
const time = (date: Date) => timeFormat.format(date);
function range(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();
  return `${day(start)} ${time(start)} - ${sameDay ? '' : `${day(end)} `}${time(end)}`;
}

interface PostRowBase {
  id: string; title: string; summary: string; price: number; status: 'open' | 'closed'; created_at: string;
  cancelled_at: string | null; cancel_reason: string;
}
interface NewsSpaceRow extends PostRowBase { available_hours: string; capacity: number; min_hours: number | null; space_rental_categories: { name: string } | null }
interface NewsClassRow extends PostRowBase { starts_at: string; duration_minutes: number; current_count: number; max_count: number; one_day_class_categories: { name: string } | null }

const CANCELLED = { label: '등록 취소', tone: 'off' } as const;
const POST_COLUMNS = 'id, title, summary, price, status, created_at, cancelled_at, cancel_reason';
interface NewsSaleRow { id: string; offer: string; discount_type: SaleDiscountType; discount_amount: number | null; discount_rate: number | string | null; starts_at: string; ends_at: string; created_at: string }

function saleTitle(row: NewsSaleRow): string {
  const rate = row.discount_rate === null ? null : Number(row.discount_rate);
  const discount = row.discount_type === 'rate' && rate ? `${Math.round(rate * 100)}% 할인`
    : row.discount_type === 'amount' && row.discount_amount ? `${row.discount_amount.toLocaleString('ko-KR')}원 할인`
    : '무료 제공';
  return [row.offer.trim(), discount].filter(Boolean).join(' · ');
}

/** 내 가게의 공간대여·클래스 글, 끝나지 않은 마감세일, 스탬프 규칙을 한 번에 읽는다 */
export async function fetchOwnerDashboard(storeId: string): Promise<OwnerDashboard> {
  const client = getSupabaseClient();
  const nowIso = new Date().toISOString();
  const [spaces, classes, sales, stamp] = await Promise.all([
    client.from('space_rentals').select(`${POST_COLUMNS}, available_hours, capacity, min_hours, space_rental_categories(name)`).eq('store_id', storeId),
    client.from('one_day_classes').select(`${POST_COLUMNS}, starts_at, duration_minutes, current_count, max_count, one_day_class_categories(name)`).eq('store_id', storeId),
    client.from('closing_sales').select('id, offer, discount_type, discount_amount, discount_rate, starts_at, ends_at, created_at')
      .eq('store_id', storeId).gt('ends_at', nowIso),
    client.from('stamp_policies').select('required_stamps, reward, unit').eq('store_id', storeId).maybeSingle(),
  ]);
  if (spaces.error || classes.error || sales.error || stamp.error) throw new Error('가게 소식을 불러오지 못했어요.');

  const now = Date.now();
  const news: OwnerNews[] = [];
  const cancelInfo = (row: PostRowBase) => ({ cancelledAt: row.cancelled_at, cancelReason: row.cancel_reason ?? '' });
  for (const row of (spaces.data ?? []) as unknown as NewsSpaceRow[]) {
    news.push({
      id: row.id, kind: 'space-rental', title: row.title, when: row.available_hours,
      status: row.cancelled_at ? CANCELLED : row.status === 'open' ? { label: '예약 받는 중', tone: 'on' } : { label: '마감', tone: 'off' },
      createdAt: row.created_at, sortAt: row.created_at,
      post: {
        category: row.space_rental_categories?.name ?? '', summary: row.summary, price: row.price, capacity: row.capacity,
        minHours: row.min_hours, applied: null, ...cancelInfo(row),
      },
    });
  }
  for (const row of (classes.data ?? []) as unknown as NewsClassRow[]) {
    const starts = Date.parse(row.starts_at);
    const ends = new Date(starts + row.duration_minutes * 60_000).toISOString();
    news.push({
      id: row.id, kind: 'oneday-class', title: row.title, when: range(row.starts_at, ends),
      status: row.cancelled_at ? CANCELLED : starts <= now ? { label: '종료', tone: 'off' } : row.status === 'open' ? { label: '모집 중', tone: 'on' } : { label: '모집 마감', tone: 'soon' },
      createdAt: row.created_at, sortAt: row.starts_at,
      post: {
        category: row.one_day_class_categories?.name ?? '', summary: row.summary, price: row.price, capacity: row.max_count,
        minHours: null, applied: row.current_count, ...cancelInfo(row),
      },
    });
  }
  for (const row of (sales.data ?? []) as NewsSaleRow[]) {
    news.push({
      id: row.id, kind: 'closing-sale', title: saleTitle(row), when: range(row.starts_at, row.ends_at),
      status: Date.parse(row.starts_at) <= now ? { label: '진행 중', tone: 'on' } : { label: '예정', tone: 'soon' },
      createdAt: row.created_at, sortAt: row.starts_at,
    });
  }
  if (stamp.data) {
    news.push({
      id: `stamp-${storeId}`, kind: 'coupon', title: `${stamp.data.required_stamps}개 모으면 ${stamp.data.reward}`, when: `${stamp.data.unit}마다 1개`,
      status: { label: '운영 중', tone: 'on' }, createdAt: '', sortAt: '',
    });
  }

  return { news };
}

/**
 * 공간대여·클래스 등록 취소. 글을 비공개·마감으로 바꾸고 취소 시각과 사유를 남긴다 (손님 목록에서 사라진다).
 * 이미 신청한 손님에게 알려 주는 기능은 아직 없어서, 화면에서 사장님이 직접 연락하도록 안내한다.
 */
export async function cancelOwnerPost(kind: 'space-rental' | 'oneday-class', id: string, reason: string): Promise<void> {
  const text = reason.trim();
  if (text.length < 1) throw new Error('취소 사유를 적어 주세요.');
  if (text.length > 500) throw new Error('취소 사유는 500자 이내로 적어 주세요.');
  const { data, error } = await getSupabaseClient().from(kind === 'space-rental' ? 'space_rentals' : 'one_day_classes')
    .update({ status: 'closed', is_published: false, cancelled_at: new Date().toISOString(), cancel_reason: text })
    .eq('id', id).select('id');
  if (error || !data?.length) throw new Error('등록을 취소하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  forgetStores();
  window.dispatchEvent(new Event(FEED_CHANGE_EVENT));
}

// ---------- 스탬프 혜택 ----------

export interface StampPolicyInput {
  requiredStamps: number;
  reward: string;
  unit: string;
  condition: string;
}

export async function fetchOwnerStampPolicy(storeId: string): Promise<StampPolicyInput | null> {
  const { data, error } = await getSupabaseClient().from('stamp_policies')
    .select('required_stamps, reward, unit, condition').eq('store_id', storeId).maybeSingle();
  if (error) throw new Error('스탬프 혜택을 불러오지 못했어요.');
  return data ? { requiredStamps: data.required_stamps, reward: data.reward, unit: data.unit, condition: data.condition } : null;
}

/** DB stamp_policies check 와 같은 검사 */
export function validateStampPolicy(input: StampPolicyInput): string | null {
  if (!Number.isInteger(input.requiredStamps) || input.requiredStamps < 1 || input.requiredStamps > 100) return '모을 개수는 1 ~ 100개로 입력해 주세요.';
  const reward = input.reward.trim();
  if (reward.length < 1 || reward.length > 300) return '받는 선물을 300자 이내로 입력해 주세요.';
  const unit = input.unit.trim();
  if (unit.length < 1 || unit.length > 100) return '1개를 찍어 주는 기준을 100자 이내로 입력해 주세요.';
  if (input.condition.length > 1000) return '조건은 1000자 이내로 입력해 주세요.';
  return null;
}

/** 가게당 규칙은 하나라서, 있으면 고치고 없으면 새로 만든다 */
export async function saveStampPolicy(storeId: string, input: StampPolicyInput, exists: boolean): Promise<void> {
  const problem = validateStampPolicy(input);
  if (problem) throw new Error(problem);
  const values = { required_stamps: input.requiredStamps, reward: input.reward.trim(), unit: input.unit.trim(), condition: input.condition.trim() };
  const client = getSupabaseClient();
  // 권한이 칸별로 나뉘어 있어(insert 는 store_id 포함, update 는 제외) upsert 대신 나눠서 보낸다
  const { error } = exists
    ? await client.from('stamp_policies').update(values).eq('store_id', storeId)
    : await client.from('stamp_policies').insert({ store_id: storeId, ...values });
  if (error) throw new Error('스탬프 혜택을 저장하지 못했어요.');
  forgetStores();
}

/** 스탬프판을 없앤다. 손님들이 모은 스탬프와 이력도 함께 지워진다 (DB on delete cascade) */
export async function deleteStampPolicy(storeId: string): Promise<void> {
  const { data, error } = await getSupabaseClient().from('stamp_policies').delete().eq('store_id', storeId).select('store_id');
  if (error || !data?.length) throw new Error('스탬프 혜택을 없애지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  forgetStores();
}

// ---------- 스탬프 적립 (손님 코드 입력) ----------

export interface StampRedeemResult {
  /** 손님의 적립 후 잔액 */
  balance: number;
  requiredStamps: number;
}

/** 손님이 보여준 6자리 코드로 스탬프를 찍는다. 코드 확인·적립은 서버(redeem_stamp_code)가 한 번에 한다 */
export async function redeemStampCode(storeId: string, code: string, count: number): Promise<StampRedeemResult> {
  if (!/^\d{6}$/.test(code)) throw new Error('6자리 숫자 코드를 입력해 주세요.');
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('찍을 개수는 1 ~ 100개로 입력해 주세요.');
  const { data, error } = await getSupabaseClient().rpc('redeem_stamp_code', { p_store_id: storeId, p_code: code, p_count: count });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    if (error?.code === 'P0002') throw new Error('코드가 맞지 않거나 시간이 지났어요. 손님 화면의 번호를 다시 확인해 주세요.');
    if (error?.code === '42501') throw new Error('이 가게의 사장님만 스탬프를 찍을 수 있어요.');
    throw new Error('스탬프를 찍지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }
  return { balance: row.balance, requiredStamps: row.required_stamps };
}
