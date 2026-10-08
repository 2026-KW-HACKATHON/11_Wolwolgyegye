import { fetchStoresByIds } from '../../core/source/storeSource';
import { resolveStoreMediaUrl } from '../../core/source/mediaUrl';
import { getSupabaseClient } from '../../core/supabase/client';
import type { Store } from '../../core/types/place';
import { FEED_CATEGORIES, type ClassPost, type FeedKind, type FeedPost, type PostInput, type SpacePost } from './types';

export const FEED_CHANGE_EVENT = 'wol-owner-posts-changed';
const feedStoreCache = new Map<string, Store>();

export function findFeedStore(id: string): Store | undefined {
  return feedStoreCache.get(id);
}

/** 현재 로그인한 사장님 소유 가게를 글 작성 후보로 돌려준다. */
export async function fetchFeedStores(): Promise<Store[]> {
  const client = getSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];
  const { data, error } = await client.from('stores').select('id').eq('owner_id', user.id).order('name');
  if (error) throw new Error('글을 등록할 가게를 불러오지 못했어요.');
  const stores = await fetchStoresByIds((data ?? []).map((row) => row.id));
  for (const store of stores.values()) feedStoreCache.set(store.id, store);
  return [...stores.values()];
}

interface ImageRow { image_path: string; sort_order: number }
interface SpaceRow {
  id: string; store_id: string; title: string; summary: string; body: string; available_hours: string;
  price: number; capacity: number; min_hours: number | null; status: 'open' | 'closed'; created_at: string;
  space_rental_categories: { name: string } | null; space_rental_images: ImageRow[];
}
interface ClassRow {
  id: string; store_id: string; title: string; summary: string; body: string; starts_at: string; duration_minutes: number;
  price: number; max_count: number; status: 'open' | 'closed'; created_at: string;
  one_day_class_categories: { name: string } | null; one_day_class_images: ImageRow[];
}

function firstImageUrl(images: ImageRow[]): string {
  const first = [...(images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
  return first ? resolveStoreMediaUrl(first.image_path) : '';
}

/** 공개 가게의 공간대여·원데이클래스 글을 DB에서 읽는다. */
export async function fetchFeedPosts(kind: FeedKind): Promise<FeedPost[]> {
  const client = getSupabaseClient();
  let posts: FeedPost[];
  if (kind === 'space-rental') {
    const { data, error } = await client.from('space_rentals')
      .select('id, store_id, title, summary, body, available_hours, price, capacity, min_hours, status, created_at, space_rental_categories(name), space_rental_images(image_path, sort_order)')
      .eq('is_published', true) // 사장님은 자기 가게의 비공개(등록 취소한) 글도 읽을 수 있어서, 손님 목록에는 공개 글만
      .order('created_at', { ascending: false });
    if (error) throw new Error('공간 대여 소식을 불러오지 못했어요.');
    posts = ((data ?? []) as unknown as SpaceRow[]).map((row): SpacePost => ({
      id: row.id, kind, storeId: row.store_id, title: row.title,
      summary: row.summary, description: row.body,
      category: row.space_rental_categories?.name ?? '', price: row.price, capacity: row.capacity,
      contactPhone: '', imageUrl: firstImageUrl(row.space_rental_images), createdAt: row.created_at,
      status: row.status, schedule: row.available_hours, minimumHours: row.min_hours,
    }));
  } else {
    const { data, error } = await client.from('one_day_classes')
      .select('id, store_id, title, summary, body, starts_at, duration_minutes, price, max_count, status, created_at, one_day_class_categories(name), one_day_class_images(image_path, sort_order)')
      .eq('is_published', true)
      .order('starts_at');
    if (error) throw new Error('원데이클래스 소식을 불러오지 못했어요.');
    posts = ((data ?? []) as unknown as ClassRow[]).map((row): ClassPost => ({
      id: row.id, kind, storeId: row.store_id, title: row.title,
      summary: row.summary, description: row.body,
      category: row.one_day_class_categories?.name ?? '', price: row.price, capacity: row.max_count,
      contactPhone: '', imageUrl: firstImageUrl(row.one_day_class_images), createdAt: row.created_at,
      status: row.status, startsAt: row.starts_at, durationMinutes: row.duration_minutes,
    }));
  }
  const stores = await fetchStoresByIds(posts.map((post) => post.storeId));
  return posts.flatMap((post) => {
    const store = stores.get(post.storeId);
    if (!store) return [];
    feedStoreCache.set(store.id, store);
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

export function validatePost(value: unknown, checkFuture = true): string | null {
  if (!value || typeof value !== 'object') return '게시글 형식이 올바르지 않아요.';
  const post = value as Record<string, unknown>;
  if (post.kind !== 'space-rental' && post.kind !== 'oneday-class') return '카테고리를 선택해 주세요.';
  if (typeof post.storeId !== 'string' || !post.storeId) return '등록할 가게를 선택해 주세요.';
  if (!text(post.title, 70) || !text(post.summary, 200) || !text(post.description, 5000)) return '제목(70자), 한 줄 요약(200자), 상세 설명(5,000자)을 입력해 주세요.';
  if (!text(post.category, 30) || !FEED_CATEGORIES[post.kind].includes(post.category)) return '올바른 세부 분류를 선택해 주세요.';
  if (!integer(post.price, 0, 10000000) || !integer(post.capacity, 1, 1000)) return '금액과 인원을 올바르게 입력해 주세요.';
  if (typeof post.imageUrl !== 'string' || !validImage(post.imageUrl)) return '이미지 형식을 확인해 주세요.';
  if (post.status !== 'open' && post.status !== 'closed') return '모집 상태를 확인해 주세요.';
  if (post.kind === 'space-rental') {
    if (!text(post.schedule, 200) || (post.minimumHours !== null && !integer(post.minimumHours, 1, 24))) return '이용 가능 시간과 최소 이용 시간을 입력해 주세요.';
  } else {
    if (typeof post.startsAt !== 'string' || !Number.isFinite(Date.parse(post.startsAt))) return '수업 날짜와 시간을 입력해 주세요.';
    if (checkFuture && post.status === 'open' && Date.parse(post.startsAt) <= Date.now()) return '수업 시작 시간은 현재 이후로 선택해 주세요.';
    if (!integer(post.durationMinutes, 15, 1440)) return '수업 시간은 15분~1,440분 사이로 입력해 주세요.';
  }
  return null;
}

async function categoryId(kind: FeedKind, name: string): Promise<string> {
  const table = kind === 'space-rental' ? 'space_rental_categories' : 'one_day_class_categories';
  const { data, error } = await getSupabaseClient().from(table).select('id').eq('name', name).maybeSingle();
  if (error || !data) throw new Error('게시글 분류를 확인하지 못했어요. 관리자에게 문의해 주세요.');
  return data.id;
}

async function uploadPostImage(input: Pick<PostInput, 'storeId' | 'kind' | 'imageUrl'>, postId: string): Promise<string> {
  if (!input.imageUrl.startsWith('data:image/')) return input.imageUrl;
  const response = await fetch(input.imageUrl);
  const blob = await response.blob();
  const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${input.storeId}/${input.kind}/${postId}-${crypto.randomUUID()}.${extension}`;
  const { error } = await getSupabaseClient().storage.from('store-media').upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error('대표 사진을 업로드하지 못했어요.');
  return path;
}

export async function saveFeedPost(input: PostInput, existingId?: string): Promise<FeedPost> {
  const validation = validatePost(input);
  if (validation) throw new Error(validation);
  const client = getSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('사장님 계정으로 로그인해 주세요.');
  const { data: owned } = await client.from('stores').select('id').eq('id', input.storeId).eq('owner_id', user.id).maybeSingle();
  if (!owned) throw new Error('이 가게의 게시글을 관리할 권한이 없어요.');
  const resolvedCategoryId = await categoryId(input.kind, input.category);

  let row: { id: string; created_at: string };
  if (input.kind === 'space-rental') {
    const payload = {
      store_id: input.storeId, category_id: resolvedCategoryId, title: input.title,
      summary: input.summary, body: input.description, available_hours: input.schedule,
      price: input.price, capacity: input.capacity, min_hours: input.minimumHours,
      status: input.status, is_published: true,
    };
    const result = existingId
      ? await client.from('space_rentals').update(payload).eq('id', existingId).select('id, created_at').single()
      : await client.from('space_rentals').insert(payload).select('id, created_at').single();
    if (result.error) throw new Error('공간 대여 글을 저장하지 못했어요. 입력 내용과 가게 권한을 확인해 주세요.');
    row = result.data;
  } else {
    const payload = {
      store_id: input.storeId, category_id: resolvedCategoryId, title: input.title,
      summary: input.summary, body: input.description, starts_at: input.startsAt,
      duration_minutes: input.durationMinutes, price: input.price, max_count: input.capacity,
      status: input.status, is_published: true,
    };
    const result = existingId
      ? await client.from('one_day_classes').update(payload).eq('id', existingId).select('id, created_at').single()
      : await client.from('one_day_classes').insert({ ...payload, current_count: 0 }).select('id, created_at').single();
    if (result.error) throw new Error('원데이클래스 글을 저장하지 못했어요. 입력 내용과 가게 권한을 확인해 주세요.');
    row = result.data;
  }

  let imageUrl = input.imageUrl;
  if (input.imageUrl.startsWith('data:image/')) {
    const imagePath = await uploadPostImage(input, row.id);
    const imageTable = input.kind === 'space-rental' ? 'space_rental_images' : 'one_day_class_images';
    const foreignKey = input.kind === 'space-rental' ? 'space_rental_id' : 'one_day_class_id';
    if (existingId) await client.from(imageTable).delete().eq(foreignKey, row.id);
    const { error: imageError } = await client.from(imageTable).insert({ [foreignKey]: row.id, image_path: imagePath, sort_order: 0 });
    if (imageError) throw new Error('글은 저장됐지만 대표 사진 정보를 연결하지 못했어요.');
    imageUrl = client.storage.from('store-media').getPublicUrl(imagePath).data.publicUrl;
  } else if (existingId && !input.imageUrl) {
    const imageTable = input.kind === 'space-rental' ? 'space_rental_images' : 'one_day_class_images';
    const foreignKey = input.kind === 'space-rental' ? 'space_rental_id' : 'one_day_class_id';
    await client.from(imageTable).delete().eq(foreignKey, row.id);
  }

  window.dispatchEvent(new Event(FEED_CHANGE_EVENT));
  const contactPhone = findFeedStore(input.storeId)?.phone ?? '';
  return { ...input, id: row.id, imageUrl, createdAt: row.created_at, contactPhone } as FeedPost;
}

/**
 * 대표 사진(sort_order 0) 뒤에 사진을 더 붙인다. 공간 대여 등록처럼 사진을 여러 장 고르는 화면에서 saveFeedPost 다음에 부른다.
 * dataUrls 는 PostForm 과 같은 data:image 값 (1MB 이하 JPG·PNG·WebP).
 */
export async function addPostImages(post: Pick<FeedPost, 'id' | 'storeId' | 'kind'>, dataUrls: string[]): Promise<void> {
  if (dataUrls.length === 0) return;
  if (!dataUrls.every((url) => url.startsWith('data:image/') && validImage(url))) throw new Error('사진 형식을 확인해 주세요.');
  const client = getSupabaseClient();
  const imageTable = post.kind === 'space-rental' ? 'space_rental_images' : 'one_day_class_images';
  const foreignKey = post.kind === 'space-rental' ? 'space_rental_id' : 'one_day_class_id';
  const paths = await Promise.all(dataUrls.map((imageUrl) => uploadPostImage({ storeId: post.storeId, kind: post.kind, imageUrl }, post.id)));
  const { error } = await client.from(imageTable).insert(paths.map((imagePath, index) => ({ [foreignKey]: post.id, image_path: imagePath, sort_order: index + 1 })));
  if (error) throw new Error('글은 저장됐지만 추가 사진을 연결하지 못했어요.');
}

export async function deleteFeedPost(id: string, kind: FeedKind): Promise<void> {
  const table = kind === 'space-rental' ? 'space_rentals' : 'one_day_classes';
  const { error } = await getSupabaseClient().from(table).delete().eq('id', id);
  if (error) throw new Error('게시글을 삭제하지 못했어요. 가게 권한을 확인해 주세요.');
  window.dispatchEvent(new Event(FEED_CHANGE_EVENT));
}
