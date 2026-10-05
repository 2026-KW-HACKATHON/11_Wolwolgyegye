export type FeedKind = 'space-rental' | 'oneday-class';
type FeedStatus = 'open' | 'closed';

/** 게시글 규격. 공통 가게 정보는 core/types/place.ts의 Store를 storeId로 참조한다. */
interface PostBase {
  id: string;
  kind: FeedKind;
  storeId: string;
  title: string;
  /** 한 줄 요약 (DB summary). 목록 카드(1차 탭)에만 보인다 */
  summary: string;
  /** 상세 설명 (DB body). 가게 화면(2차 탭)에만 보인다 */
  description: string;
  category: string;
  /** 공간은 시간당, 클래스는 1인당 원 단위 금액 */
  price: number;
  capacity: number;
  /** 문의 번호 = 가게 전화(stores.phone). 글마다 따로 저장하지 않는다 */
  contactPhone: string;
  /** 대표 사진. 비어 있으면 세부 분류별 기본 그림(CategoryArt)을 쓴다 */
  imageUrl: string;
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
  'space-rental': ['모임·파티', '스터디·회의', '촬영·작업', '연습·공연', '공유주방', '전시·팝업'],
  'oneday-class': ['요리·베이킹', '커피·음료', '공예·미술', '꽃·식물', '향·캔들', '운동·건강'],
};

export function isAvailable(post: FeedPost, now = Date.now()): boolean {
  return post.status === 'open' && (post.kind === 'space-rental' || Date.parse(post.startsAt) > now);
}

export function formatPrice(post: Pick<FeedPost, 'kind' | 'price'>): string {
  return post.price.toLocaleString('ko-KR') + (post.kind === 'space-rental' ? '원 / 시간' : '원 / 1인');
}
