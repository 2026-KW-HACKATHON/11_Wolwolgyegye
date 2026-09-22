/**
 * 가게(장소) 공통 데이터 규격.
 *
 * 설계 원칙:
 * - 여기 있는 필드는 "여러 카테고리가 한 지도/목록에 함께 표시될 때" 쓰는 최소 공통 필드다.
 * - 카테고리별 상세 데이터(메뉴, 마감세일 상품, 대여 공간, 클래스, 쿠폰 정책)는 여기 두지 않고
 *   각 features/<카테고리>/types.ts 에서 따로 정의한다. 그 상세 데이터의 각 항목은 storeId 로
 *   이 Store 를 참조한다 (관계형 DB의 외래키와 같은 개념).
 * - 이 파일은 여러 팀원이 공유하는 "고정 규격"이라, 기존 필드는 바꾸지 않고 필요한 필드는 추가만 한다.
 * - 실제 DB(Supabase/Postgres) 연동 시 이 Store 는 stores 테이블이 되고,
 *   각 카테고리 상세는 store_id 외래키를 가진 별도 테이블이 된다.
 */

/** 위도/경도 좌표. 카카오맵 등 지도 API가 쓰는 형식이며, 화면 픽셀 좌표가 아니다. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * 가게가 지원하는 선택형 카테고리 여부.
 * 키는 core/categories/categories.ts 의 카테고리 id 와 반드시 같아야 한다.
 * '추천'은 가게가 스스로 켜고 끄는 값이 아니라 앱이 골라서 보여주는 목록이라 여기 포함하지 않는다.
 * 모든 키가 항상 있을 필요는 없어서 Partial 로 둔다: 없는 키는 "지원 안 함"과 같은 의미다.
 */
export type CategorySupport = Partial<
  Record<
    | 'space-rental'
    | 'oneday-class'
    | 'roulette'
    | 'closing-sale'
    | 'coupon'
    | 'partner-stores',
    boolean
  >
>;

export interface Store {
  id: string;
  name: string;

  /** 음식 종류 등 업종 세부 분류 (예: "양식", "한식"). 해당 없는 가게는 생략 가능 */
  cuisineType?: string;

  location: GeoPoint;
  /** 지도에는 위경도만 쓰지만, 목록/상세 화면에 사람이 읽을 주소가 필요해서 별도로 둔다 */
  address: string;

  thumbnailUrl: string;
  /** 지금은 자유 문자열로 둔다. 예: "매일 10:00 - 21:00" (요일별 구조화는 다음 단계에서 검토) */
  businessHours: string;
  phone: string;

  supports: CategorySupport;
}