/**
 * 가게(장소) 데이터 규격.
 *
 * 설계 원칙:
 * - "가게 공통 정보"와 "카테고리별 상세 데이터"를 분리한다.
 * - 공통 정보(위치, 주소, 영업시간 등)는 지도/목록에 여러 카테고리가 함께 표시될 때 쓰는 최소 필드다.
 * - 카테고리별 상세(메뉴, 마감세일 상품, 대여 공간, 클래스, 쿠폰 정책)는 카테고리마다 모양이 달라서
 *   각자 다른 타입으로 따로 정의하고, Store 에는 "그 카테고리를 지원할 때만 값이 있는" 선택 필드로 붙인다.
 * - 실제 DB(Supabase/Postgres) 연동 시 supabase/schema.sql 이 이 타입들을 SQL 표로 옮긴 것이 된다.
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

/** 제휴 가게가 파는 메뉴 하나 (이름 + 가격) */
export interface MenuItem {
  id: string;
  name: string;
  /** 원 단위 정수 */
  price: number;
}

/** '제휴 가게' 카테고리 상세: 어디와 제휴 중인지 + 메뉴 목록 */
export interface PartnerStoreDetail {
  /** 제휴를 맺은 대상(다른 가게/브랜드 등) 목록 */
  partnerWith: string[];
  items: MenuItem[];
}

/** 마감세일 중인 상품 하나. 할인가는 저장하지 않고 원가 x (1 - 할인률) 로 계산해서 쓴다 */
export interface ClosingSaleItem {
  id: string;
  name: string;
  /** 원 단위 정수 */
  originalPrice: number;
  /** 0 ~ 1 사이 소수. 예: 0.3 = 30% 할인 */
  discountRate: number;
}

/** '마감세일' 카테고리 상세 */
export interface ClosingSaleDetail {
  items: ClosingSaleItem[];
}

/** 대여 가능한 공간 하나 */
export interface SpaceRentalSpace {
  id: string;
  name: string;
  /** 시간당 대여료 (원) */
  pricePerHour: number;
  /** 대여 가능 시간대. 골격 단계라 단순 문자열 목록으로 둔다 (예: "10:00-12:00") */
  timeSlots: string[];
}

/** '공간 대여' 카테고리 상세 */
export interface SpaceRentalDetail {
  spaces: SpaceRentalSpace[];
}

/** 개설된 원데이클래스 하나 */
export interface OnedayClassItem {
  id: string;
  name: string;
  /** 골격 단계라 자유 문자열/ISO 문자열로 둔다. 예: "2026-10-04T14:00:00" */
  datetime: string;
  /** 정원 (명) */
  capacity: number;
  /** 참가비 (원) */
  fee: number;
}

/** '원데이클래스' 카테고리 상세 */
export interface OnedayClassDetail {
  classes: OnedayClassItem[];
}

/**
 * '쿠폰제' 카테고리 상세: 가게의 쿠폰 정책만 담는다.
 * "이 손님이 몇 번 찍었는지"(사용자별 스탬프 개수)는 로그인한 사용자 한 명 한 명에게 딸린
 * 완전히 다른 데이터라서 여기 포함하지 않는다. 로그인 연동 단계에서 별도 표로 설계한다.
 */
export interface CouponDetail {
  /** 혜택을 받기까지 채워야 하는 방문(도장) 횟수 */
  requiredStamps: number;
  /** 혜택 내용 (예: "음료 1잔 무료") */
  reward: string;
}

/**
 * '룰렛' 카테고리는 별도 상세 타입이 없다.
 * 룰렛에 포함할 항목은 그 가게가 이미 가진 다른 카테고리의 항목(메뉴 등)을 화면에서 골라 구성하므로
 * 여기 새로 저장할 데이터가 없다.
 */

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

  /** supports['partner-stores'] 가 true 일 때만 값이 있다 */
  partnerStoreDetail?: PartnerStoreDetail;
  /** supports['closing-sale'] 가 true 일 때만 값이 있다 */
  closingSaleDetail?: ClosingSaleDetail;
  /** supports['space-rental'] 가 true 일 때만 값이 있다 */
  spaceRentalDetail?: SpaceRentalDetail;
  /** supports['oneday-class'] 가 true 일 때만 값이 있다 */
  onedayClassDetail?: OnedayClassDetail;
  /** supports['coupon'] 가 true 일 때만 값이 있다 */
  couponDetail?: CouponDetail;
}