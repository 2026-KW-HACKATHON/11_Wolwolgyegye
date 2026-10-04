import { fetchStoresByIds } from '../../core/source/storeSource';
import { getSupabaseClient } from '../../core/supabase/client';
import type { Store } from '../../core/types/place';
import { FEED_CATEGORIES, type ClassPost, type FeedKind, type FeedPost, type PostInput, type SpacePost } from './types';

export const POST_STORAGE_KEY = 'wol-owner-posts-v1';
export const FEED_CHANGE_EVENT = 'wol-owner-posts-changed';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * 글에 붙는 가게. DB 글을 읽을 때 그 글의 가게를 여기에 모아 두고, 화면은 findFeedStore 로 바로 꺼낸다.
 * 이 브라우저에서 새 글을 올릴 가게 목록(feedStores)도 여기서 고른다.
 * TODO(로그인): 글 올리기는 사장님 본인 가게로 바꾼다.
 */
const feedStoreCache = new Map<string, Store>();

export function findFeedStore(id: string): Store | undefined {
  return feedStoreCache.get(id);
}

export function feedStores(kind: FeedKind): Store[] {
  return [...feedStoreCache.values()].filter((store) => store.supports[kind]);
}

interface ImageRow { image_path: string; sort_order: number }
interface SpaceRow {
  id: string; store_id: string; title: string; summary: string; body: string; available_hours: string;
  price: number; capacity: number; min_hours: number | null; created_at: string;
  space_rental_categories: { name: string } | null; space_rental_images: ImageRow[];
}
interface ClassRow {
  id: string; store_id: string; title: string; summary: string; body: string; starts_at: string; duration_minutes: number;
  price: number; current_count: number; max_count: number; created_at: string;
  one_day_class_categories: { name: string } | null; one_day_class_images: ImageRow[];
}

/** 사진 경로 → 공개 주소 (첫 장만 쓴다). 없으면 '' */
function firstImageUrl(images: ImageRow[]): string {
  const first = [...(images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
  return first ? getSupabaseClient().storage.from('store-media').getPublicUrl(first.image_path).data.publicUrl : '';
}

/** DB 의 공간대여·원데이클래스 글 (공개 가게의 공개 글만, RLS). 실패하면 빈 목록 */
async function fetchDbPosts(kind: FeedKind): Promise<FeedPost[]> {
  let posts: FeedPost[];
  try {
    const client = getSupabaseClient();
    if (kind === 'space-rental') {
      const { data, error } = await client.from('space_rentals')
        .select('id, store_id, title, summary, body, available_hours, price, capacity, min_hours, created_at, space_rental_categories(name), space_rental_images(image_path, sort_order)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      posts = ((data ?? []) as unknown as SpaceRow[]).map((r): SpacePost => ({
        id: r.id, kind, storeId: r.store_id, title: r.title,
        description: r.body || r.summary, notes: r.body ? r.summary : '',
        category: r.space_rental_categories?.name ?? '', price: r.price, capacity: r.capacity,
        contactPhone: '', imageUrl: firstImageUrl(r.space_rental_images), createdAt: r.created_at,
        status: 'open', origin: 'db', schedule: r.available_hours, minimumHours: r.min_hours ?? 1,
      }));
    } else {
      const { data, error } = await client.from('one_day_classes')
        .select('id, store_id, title, summary, body, starts_at, duration_minutes, price, current_count, max_count, created_at, one_day_class_categories(name), one_day_class_images(image_path, sort_order)')
        .order('starts_at');
      if (error) throw error;
      posts = ((data ?? []) as unknown as ClassRow[]).map((r): ClassPost => ({
        id: r.id, kind, storeId: r.store_id, title: r.title,
        description: r.body || r.summary, notes: r.body ? r.summary : '',
        category: r.one_day_class_categories?.name ?? '', price: r.price, capacity: r.max_count, enrolled: r.current_count,
        contactPhone: '', imageUrl: firstImageUrl(r.one_day_class_images), createdAt: r.created_at,
        status: r.current_count >= r.max_count ? 'closed' : 'open', origin: 'db', startsAt: r.starts_at, durationMinutes: r.duration_minutes,
      }));
    }
  } catch {
    return [];
  }
  // 글의 가게를 붙이고(전화번호는 가게 전화), 가게가 없는 글은 뺀다
  const stores = await fetchStoresByIds(posts.map((p) => p.storeId));
  return posts.flatMap((post) => {
    const store = stores.get(post.storeId);
    if (!store) return [];
    const cached = feedStoreCache.get(store.id) ?? { ...store, supports: {} };
    feedStoreCache.set(store.id, { ...cached, supports: { ...cached.supports, [kind]: true } });
    return [{ ...post, contactPhone: store.phone }];
  });
}

function text(value: unknown, max: number, required = true): value is string {
  return typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
function validImage(value: string): boolean {
  if (!value) return true;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value.length <= 1_400_000;
  try { return new URL(value).protocol === 'https:' && value.length <= 2048; } catch { return false; }
}

/** UI 검증과 별도로 저장 경계에서 검사한다. 서버 연동 후에는 서버에서도 검증해야 한다. */
export function validatePost(value: unknown, checkFuture = true): string | null {
  if (!value || typeof value !== 'object') return '게시글 형식이 올바르지 않아요.';
  const p = value as Record<string, unknown>;
  if (p.kind !== 'space-rental' && p.kind !== 'oneday-class') return '카테고리를 선택해 주세요.';
  if (typeof p.storeId !== 'string' || !feedStores(p.kind).some((s) => s.id === p.storeId)) return '등록할 가게를 선택해 주세요.';
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

function browserStorage(): StoragePort {
  try { return window.localStorage; } catch { throw new Error('브라우저 저장소를 사용할 수 없어요. 저장소 설정을 확인해 주세요.'); }
}
function readLocalPosts(storage?: StoragePort): FeedPost[] {
  const raw = (storage ?? browserStorage()).getItem(POST_STORAGE_KEY);
  if (!raw) return [];
  let rows: unknown;
  try { rows = JSON.parse(raw); } catch { throw new Error('저장된 게시글을 읽을 수 없어요. 브라우저 데이터를 확인해 주세요.'); }
  if (!Array.isArray(rows) || !rows.every((p) => p && p.origin === 'local' && typeof p.id === 'string' && p.id.startsWith('local-') && typeof p.createdAt === 'string' && Number.isFinite(Date.parse(p.createdAt)) && !validatePost(p, false))) {
    throw new Error('저장된 게시글 형식이 올바르지 않아요. 기존 데이터는 덮어쓰지 않았어요.');
  }
  return rows;
}
function persist(posts: FeedPost[], storage?: StoragePort) {
  try { (storage ?? browserStorage()).setItem(POST_STORAGE_KEY, JSON.stringify(posts)); }
  catch { throw new Error('저장 공간이 부족하거나 저장이 차단됐어요. 사진 용량을 줄이거나 브라우저 설정을 확인해 주세요.'); }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FEED_CHANGE_EVENT));
}

/**
 * 글 목록 = DB 글 + 이 브라우저에서 만든 글.
 * TODO(로그인): 글 저장·수정·삭제(saveFeedPost 등)를 DB 로 옮긴다. 지금은 이 브라우저에만 저장된다.
 */
export async function fetchFeedPosts(kind: FeedKind, storage?: StoragePort): Promise<FeedPost[]> {
  const dbPosts = await fetchDbPosts(kind);
  return [...readLocalPosts(storage).filter((p) => p.kind === kind), ...dbPosts];
}
export async function saveFeedPost(input: PostInput, existingId?: string, storage?: StoragePort): Promise<FeedPost> {
  const error = validatePost(input);
  if (error) throw new Error(error);
  const posts = readLocalPosts(storage);
  const existing = existingId ? posts.find((p) => p.id === existingId && p.kind === input.kind) : undefined;
  if (existingId && !existing) throw new Error('이 브라우저에서 등록한 글만 수정할 수 있어요.');
  const post = { ...input, id: existing?.id ?? 'local-' + crypto.randomUUID(), createdAt: existing?.createdAt ?? new Date().toISOString(), origin: 'local' as const } as FeedPost;
  persist([post, ...posts.filter((p) => p.id !== post.id)], storage);
  return post;
}
export async function deleteFeedPost(id: string, storage?: StoragePort): Promise<void> {
  const posts = readLocalPosts(storage);
  if (!posts.some((p) => p.id === id)) throw new Error('이 브라우저에서 등록한 글만 삭제할 수 있어요.');
  persist(posts.filter((p) => p.id !== id), storage);
}
