import type { Store } from '../../core/types/place';
import { FEED_CATEGORIES, type FeedKind, type FeedPost, type PostInput } from './types';

export const POST_STORAGE_KEY = 'wol-owner-posts-v1';
export const FEED_CHANGE_EVENT = 'wol-owner-posts-changed';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * 글에 연결할 수 있는 가게 목록. TODO(DB): stores 테이블 연결.
 * 그 전까지는 가게가 없어서 글을 새로 올릴 수 없다. (가짜 가게를 쓰지 않는다)
 */
const FEED_STORES: Store[] = [];

export function findFeedStore(id: string): Store | undefined {
  return FEED_STORES.find((store) => store.id === id);
}

export function feedStores(kind: FeedKind): Store[] {
  return FEED_STORES.filter((store) => store.supports[kind]);
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

/** Supabase 연결 시 이 모듈의 조회/저장 구현을 교체한다. 현재 데이터는 브라우저별로 분리된다. */
export async function fetchFeedPosts(kind: FeedKind, storage?: StoragePort): Promise<FeedPost[]> {
  // TODO(DB): space_rentals · oneday_classes 테이블 연결. 지금은 이 브라우저에서 만든 글만 돌려준다.
  return readLocalPosts(storage).filter((p) => p.kind === kind);
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
