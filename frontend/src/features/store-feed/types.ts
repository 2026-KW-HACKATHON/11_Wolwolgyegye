export type FeedKind = 'space-rental' | 'oneday-class';
type FeedStatus = 'open' | 'closed';

/** 게시글 규격. 공통 가게 정보는 core/types/place.ts의 Store를 storeId로 참조한다. */
interface PostBase {
  id: string;
  kind: FeedKind;
  storeId: string;
  title: string;
  description: string;
  category: string;
  /** 공간은 시간당, 클래스는 1인당 원 단위 금액 */
  price: number;
  capacity: number;
  /** 문의 번호 = 가게 전화(stores.phone). 글마다 따로 저장하지 않는다 */
  contactPhone: string;
  imageUrl: string;
  /** 이용 안내 / 준비물 / 포함 사항 */
  notes: string;
  createdAt: string;
  status: FeedStatus;
}

export interface SpacePost extends PostBase {
  kind: 'space-rental';
  schedule: string;
  /** 최소 이용 시간. DB min_hours 가 비어 있으면 null (표시 안 함) */
  minimumHours: number | null;
}

export interface ClassPost extends PostBase {
  kind: 'oneday-class';
  startsAt: string;
  durationMinutes: number;
}

export type FeedPost = SpacePost | ClassPost;
type InputOmit = 'id' | 'createdAt' | 'contactPhone';
export type PostInput = Omit<SpacePost, InputOmit> | Omit<ClassPost, InputOmit>;

export const FEED_CATEGORIES: Record<FeedKind, readonly string[]> = {
  'space-rental': ['모임·파티', '스터디·회의', '촬영·작업'],
  'oneday-class': ['요리·베이킹', '공예·미술', '커피·음료'],
};

export function isAvailable(post: FeedPost, now = Date.now()): boolean {
  return post.status === 'open' && (post.kind === 'space-rental' || Date.parse(post.startsAt) > now);
}

export function formatPrice(post: Pick<FeedPost, 'kind' | 'price'>): string {
  return post.price.toLocaleString('ko-KR') + (post.kind === 'space-rental' ? '원 / 시간' : '원 / 1인');
}
