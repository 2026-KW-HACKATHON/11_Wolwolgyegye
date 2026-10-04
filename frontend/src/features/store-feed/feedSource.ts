import { fetchStoresByIds } from '../../core/source/storeSource';
import { getSupabaseClient } from '../../core/supabase/client';
import { toStore } from '../../core/supabase/storeMapper';
import type { Store } from '../../core/types/place';
import { FEED_CATEGORIES, type FeedKind, type FeedPost, type PostInput } from './types';

export const FEED_CHANGE_EVENT = 'wol-owner-posts-changed';
const storeCache = new Map<string, Store>();

export function findFeedStore(id: string): Store | undefined {
  return storeCache.get(id);
}

/** 현재 로그인한 사장님이 소유하고, 해당 기능을 켠 가게만 글 작성 후보로 돌려준다. */
export async function fetchFeedStores(kind: FeedKind): Promise<Store[]> {
  const client = getSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];
  const { data, error } = await client.from('stores')
    .select('id, name, cuisine_type, address, lat, lng, phone, business_hours, thumbnail_path, supported_features')
    .eq('owner_id', user.id)
    .contains('supported_features', [kind])
    .order('name');
  if (error) throw new Error('글을 등록할 가게를 불러오지 못했어요.');
  const stores = (data ?? []).map((row) => toStore(row));
  for (const store of stores) storeCache.set(store.id, store);
  return stores;
}

function text(value: unknown, max: number, required = true): value is string {
  return typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
export function validImage(value: string): boolean {
  if (!value) return true;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value.length <= 1_400_000;
  try { return new URL(value).protocol === 'https:' && value.length <= 2048; } catch { return false; }
}

export function validatePost(value: unknown, checkFuture = true): string | null {
  if (!value || typeof value !== 'object') return '게시글 형식이 올바르지 않아요.';
  const p = value as Record<string, unknown>;
  if (p.kind !== 'space-rental' && p.kind !== 'oneday-class') return '카테고리를 선택해 주세요.';
  if (typeof p.storeId !== 'string' || !p.storeId) return '등록할 가게를 선택해 주세요.';
  if (!text(p.title, 70) || !text(p.description, 2000)) return '제목(70자 이내)과 소개(2,000자 이내)를 입력해 주세요.';
  if (!text(p.category, 30) || !FEED_CATEGORIES[p.kind].includes(p.category)) return '올바른 세부 분류를 선택해 주세요.';
  if (!integer(p.price, 0, 10000000) || !integer(p.capacity, 1, 1000)) return '금액과 인원을 올바르게 입력해 주세요.';
  if (typeof p.contactPhone !== 'string' || !/^[0-9+()\s-]{8,25}$/.test(p.contactPhone) || p.contactPhone.replace(/\D/g, '').length < 8) return '연락 가능한 전화번호를 입력해 주세요.';
  if (!text(p.notes, 1000, false) || typeof p.imageUrl !== 'string' || !validImage(p.imageUrl)) return '안내 문구 또는 이미지 형식을 확인해 주세요.';
  if (p.status !== 'open' && p.status !== 'closed') return '모집 상태를 확인해 주세요.';
  if (p.kind === 'space-rental') {
    if (!text(p.schedule, 200) || !integer(p.minimumHours, 1, 24)) return '이용 가능 시간과 최소 이용 시간을 입력해 주세요.';
  } else {
    if (typeof p.startsAt !== 'string' || !Number.isFinite(Date.parse(p.startsAt))) return '수업 날짜와 시간을 입력해 주세요.';
    if (checkFuture && p.status === 'open' && Date.parse(p.startsAt) <= Date.now()) return '수업 시작 시간은 현재 이후로 선택해 주세요.';
    if (!integer(p.durationMinutes, 15, 1440)) return '수업 시간은 15분~1,440분 사이로 입력해 주세요.';
  }
  return null;
}

interface FeedRow {
  id: string; store_id: string; kind: FeedKind; title: string; description: string;
  category: string; price: number; capacity: number; contact_phone: string;
  image_path: string | null; notes: string; status: 'open' | 'closed';
  schedule: string | null; minimum_hours: number | null; starts_at: string | null;
  duration_minutes: number | null; created_at: string;
}

function toFeedPost(row: FeedRow): FeedPost {
  const common = {
    id: row.id, storeId: row.store_id, title: row.title, description: row.description,
    category: row.category, price: row.price, capacity: row.capacity,
    contactPhone: row.contact_phone, imageUrl: row.image_path ?? '', notes: row.notes,
    status: row.status, createdAt: row.created_at, origin: 'db' as const,
  };
  return row.kind === 'space-rental'
    ? { ...common, kind: row.kind, schedule: row.schedule ?? '', minimumHours: row.minimum_hours ?? 1 }
    : { ...common, kind: row.kind, startsAt: row.starts_at ?? '', durationMinutes: row.duration_minutes ?? 15 };
}

const SELECT_FIELDS = 'id, store_id, kind, title, description, category, price, capacity, contact_phone, image_path, notes, status, schedule, minimum_hours, starts_at, duration_minutes, created_at';

export async function fetchFeedPosts(kind: FeedKind): Promise<FeedPost[]> {
  const { data, error } = await getSupabaseClient().from('feed_posts')
    .select(SELECT_FIELDS).eq('kind', kind).eq('is_published', true)
    .order('created_at', { ascending: false });
  if (error) throw new Error('동네 소식을 불러오지 못했어요.');
  const rows = (data ?? []) as FeedRow[];
  const stores = await fetchStoresByIds(rows.map((row) => row.store_id));
  for (const store of stores.values()) storeCache.set(store.id, store);
  return rows.filter((row) => stores.has(row.store_id)).map(toFeedPost);
}

function toPayload(input: PostInput, authorId?: string) {
  return {
    store_id: input.storeId, ...(authorId ? { author_id: authorId } : {}), kind: input.kind,
    title: input.title, description: input.description, category: input.category, price: input.price,
    capacity: input.capacity, contact_phone: input.contactPhone, image_path: input.imageUrl || null,
    notes: input.notes, status: input.status, is_published: true,
    schedule: input.kind === 'space-rental' ? input.schedule : null,
    minimum_hours: input.kind === 'space-rental' ? input.minimumHours : null,
    starts_at: input.kind === 'oneday-class' ? input.startsAt : null,
    duration_minutes: input.kind === 'oneday-class' ? input.durationMinutes : null,
  };
}

function toUpdatePayload(input: PostInput) {
  const { store_id: _storeId, kind: _kind, ...allowed } = toPayload(input);
  return allowed;
}

export async function saveFeedPost(input: PostInput, existingId?: string): Promise<FeedPost> {
  const validation = validatePost(input);
  if (validation) throw new Error(validation);
  const client = getSupabaseClient();
  let result;
  if (existingId) {
    result = await client.from('feed_posts').update(toUpdatePayload(input)).eq('id', existingId).select(SELECT_FIELDS).single();
  } else {
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('사장님 계정으로 로그인해 주세요.');
    result = await client.from('feed_posts').insert(toPayload(input, user.id)).select(SELECT_FIELDS).single();
  }
  if (result.error) throw new Error('게시글을 저장하지 못했어요. 가게 권한과 입력 내용을 확인해 주세요.');
  window.dispatchEvent(new Event(FEED_CHANGE_EVENT));
  return toFeedPost(result.data as FeedRow);
}

export async function deleteFeedPost(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('feed_posts').delete().eq('id', id);
  if (error) throw new Error('게시글을 삭제하지 못했어요. 가게 권한을 확인해 주세요.');
  window.dispatchEvent(new Event(FEED_CHANGE_EVENT));
}
